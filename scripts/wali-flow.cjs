/* End-to-end check of the wali invitation.
 *
 * The most security-sensitive link in the system (§7.1): it grants a man
 * read access to a woman's private correspondence. So the checks lean
 * hard on the ways it must NOT work — a stranger accepting, a woman
 * naming herself, two walis at once, a link used twice.
 *
 * Creates throwaway accounts and deletes them. Exits non-zero on any
 * failure, and if it ran no checks.
 *
 *   BASE=http://127.0.0.1:3007 node scripts/wali-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";

const STAMP = Date.now();
const PASSWORD = "a-long-enough-passphrase";
const SISTER = `waliflow+sister${STAMP}@example.invalid`;
const WALI = `waliflow+wali${STAMP}@example.invalid`;
const WALI2 = `waliflow+wali2${STAMP}@example.invalid`;
const emails = [SISTER, WALI, WALI2];

const findings = [];
let checks = 0;

function check(name, ok, detail = "") {
  checks++;
  if (!ok) findings.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "pass " : "FAIL "} ${name}${detail && !ok ? `  (${detail})` : ""}`);
  return ok;
}

async function register(page, email, gender) {
  await page.goto(BASE + "/register", { waitUntil: "networkidle" });
  await page.click(`label:has(input[name="gender"][value="${gender}"])`);
  await page.fill('input[name="firstName"]', gender === "sister" ? "Fatima" : "Yusuf");
  await page.fill('input[name="lastName"]', "Fixture");
  await fillDob(page, "1995-04-12");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.check('input[name="marriageIntention"]');
  await page.check('input[name="terms"]');
  await page.click('button[type="submit"]');
  await page.waitForURL("**/onboarding", { timeout: 20_000 });
}

async function devLink(page) {
  const links = page.locator('a[href*="token="]');
  if ((await links.count()) === 0) return null;
  return links.first().getAttribute("href");
}

const mongo = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

(async () => {
  await mongo.connect();
  const db = mongo.db(dbName);
  const browser = await chromium.launch();

  try {
    const herCtx = await browser.newContext();
    const her = await herCtx.newPage();
    await her.goto(BASE + "/register", { waitUntil: "networkidle" });
    await assertOurApp(her);
    await register(her, SISTER, "sister");

    const sister = await db.collection("users").findOne({ email: SISTER });

    /* ---------- she cannot name herself ----------------------------- */
    await her.goto(BASE + "/onboarding/guardian", { waitUntil: "networkidle" });
    check("the wali step shows his four powers before asking anything", /He will be able to/.test(await her.textContent("body")));

    await her.fill('input[name="name"]', "Ahmed Al-Rashid");
    await her.selectOption('select[name="relationship"]', "father");
    await her.fill('input[name="email"]', SISTER);
    await her.click('button[type="submit"]');
    await her.waitForTimeout(2500);
    check(
      "she cannot name herself as her own wali",
      /cannot be your own wali/i.test(await her.textContent("body"))
    );
    check(
      "and no guardianship was created",
      (await db.collection("guardianships").countDocuments({ memberUserId: String(sister._id) })) === 0
    );

    /* A rejected form must not throw away the rest of the answers. */
    check(
      "his name survived the rejection",
      (await her.inputValue('input[name="name"]')) === "Ahmed Al-Rashid"
    );
    check(
      "and so did the relationship",
      (await her.inputValue('select[name="relationship"]')) === "father"
    );

    /* ---------- inviting him ---------------------------------------- */
    await her.fill('input[name="email"]', WALI);
    await her.click('button[type="submit"]');
    await her.waitForTimeout(3000);
    const link = await devLink(her);
    check("an invitation link was issued", !!link, her.url());

    const g = await db.collection("guardianships").findOne({ memberUserId: String(sister._id) });
    check("a guardianship exists, invited", g && g.status === "invited");
    check("it records the relationship she chose", g && g.invited.relationship === "father");
    check(
      "the token is stored only as a digest",
      !!link && g.invited.tokenHash !== new URL(link).searchParams.get("token")
    );
    check("the digest is a sha-256", !!g && /^[0-9a-f]{64}$/.test(g.invited.tokenHash));

    /* ---------- she cannot send a second while one is open ---------- */
    await her.goto(BASE + "/onboarding/guardian", { waitUntil: "networkidle" });
    check("her step now says it is waiting on him", /Waiting on him/.test(await her.textContent("body")));

    /* ---------- her profile is still blocked ------------------------ */
    await her.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
    check(
      "an unanswered invitation does not count as a wali",
      /Waiting on your wali/.test(await her.textContent("body"))
    );

    /* ---------- the invitation page, as a stranger ------------------ */
    const hisCtx = await browser.newContext();
    const him = await hisCtx.newPage();

    await him.goto(BASE + "/wali/invite?token=not-a-real-token", { waitUntil: "networkidle" });
    check("a made-up token is refused", /did not work/i.test(await him.textContent("body")));

    await him.goto(String(link), { waitUntil: "networkidle" });
    const invitePage = await him.textContent("body");
    check("the real link opens without signing in", /named you as her wali/.test(invitePage));
    check("it names her by first name only", /Fatima/.test(invitePage) && !/Fixture/.test(invitePage));
    check("it states what he is agreeing to", /read every message/i.test(invitePage));

    /* Opening it twice must still work — he will read it and come back. */
    await him.goto(String(link), { waitUntil: "networkidle" });
    check(
      "reading the invitation does not consume it",
      /named you as her wali/.test(await him.textContent("body"))
    );

    /* ---------- he accepts ------------------------------------------ */
    await him.fill('input[name="password"]', "short");
    await him.click('button[type="submit"]');
    await him.waitForTimeout(2500);
    check("a short password is refused", /at least 10/i.test(await him.textContent("body")));
    const stillInvited = await db.collection("guardianships").findOne({ _id: g._id });
    check("and the invitation survives the failed attempt", stillInvited.status === "invited");

    await him.fill('input[name="password"]', PASSWORD);
    await him.click('button[type="submit"]');
    await him.waitForURL("**/login**", { timeout: 20_000 });
    check("accepting sends him to sign in", /confirmed as her wali/i.test(await him.textContent("body")));

    const confirmed = await db.collection("guardianships").findOne({ _id: g._id });
    check("the guardianship is confirmed", confirmed.status === "confirmed");
    check("and records when", !!confirmed.confirmedAt);

    const waliUser = await db.collection("users").findOne({ email: WALI });
    check("his account exists", !!waliUser);
    check("with the wali role, and not member", JSON.stringify(waliUser.roles) === '["wali"]');
    check(
      "his email counts as verified — the link proved he controls it",
      !!waliUser.emailVerifiedAt
    );
    check("he has no date of birth, and is not required to", waliUser.dateOfBirth === null);
    check("the guardianship points at his account", confirmed.waliUserId === String(waliUser._id));

    /* ---------- the link cannot be reused --------------------------- */
    await him.goto(String(link), { waitUntil: "networkidle" });
    check(
      "the invitation cannot be answered twice",
      /already been answered|did not work/i.test(await him.textContent("body"))
    );

    /* ---------- his portal ------------------------------------------ */
    await him.goto(BASE + "/login", { waitUntil: "networkidle" });
    await him.fill('input[name="email"]', WALI);
    await him.fill('input[name="password"]', PASSWORD);
    await him.click('button[type="submit"]');
    await him.waitForTimeout(3000);

    await him.goto(BASE + "/wali", { waitUntil: "networkidle" });
    const portal = await him.textContent("body");
    check("his portal lists his ward", /Fatima/.test(portal), him.url());
    check("and says nothing needs him yet", /Nothing needs you/i.test(portal));
    check(
      "it does not claim she is verified when she is not",
      /awaiting our checks/.test(portal)
    );

    /* ---------- and he cannot see hers ------------------------------ */
    await him.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
    check(
      "a wali is sent to his portal, not to a profile builder",
      new URL(him.url()).pathname === "/wali",
      him.url()
    );

    /* ---------- the failure paths (§6.2) ---------------------------- */
    {
      await her.goto(BASE + "/onboarding/guardian", { waitUntil: "networkidle" });
      const step = await her.textContent("body");
      check("her step shows him as confirmed", /Ahmed Al-Rashid/.test(step));
      check("and offers a way out if he can no longer act", /Name somebody else/.test(step));

      await her.click('button:has-text("Name somebody else")');
      await her.waitForSelector('input[name="name"]', { timeout: 15000 });
      check(
        "replacing warns that he loses access immediately",
        /loses access the moment/.test(await her.textContent("body"))
      );

      /* Naming the same man again is a mistake, not a replacement. */
      await her.fill('input[name="name"]', "Ahmed Al-Rashid");
      await her.selectOption('select[name="relationship"]', "father");
      await her.fill('input[name="email"]', WALI);
      await her.click('button:has-text("Send the invitation")');
      await her.waitForTimeout(2500);
      check("naming the same person again is refused", /same person/i.test(await her.textContent("body")));

      await her.fill('input[name="email"]', WALI2);
      await her.click('button:has-text("Send the invitation")');
      await her.waitForTimeout(3000);
      const secondLink = await devLink(her);
      check("a replacement invitation was issued", !!secondLink);

      const rows = await db
        .collection("guardianships")
        .find({ memberUserId: String(sister._id) })
        .toArray();
      const old = rows.find((r) => r.invited.email === WALI);
      const fresh = rows.find((r) => r.invited.email === WALI2);
      check("the old link reads as replaced, not revoked", old.status === "replaced");
      check(
        "and the two point at each other",
        old.replacedByGuardianshipId === String(fresh._id) &&
          fresh.replacesGuardianshipId === String(old._id)
      );
      check("the new one is waiting", fresh.status === "invited");

      await him.goto(BASE + "/wali", { waitUntil: "networkidle" });
      check(
        "the replaced wali no longer sees her",
        !/Fatima/.test(await him.textContent("body")),
        him.url()
      );

      await her.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
      check(
        "her profile waits on the new wali",
        /Waiting on your wali/.test(await her.textContent("body"))
      );

      /* Reminders are capped. */
      await her.goto(BASE + "/onboarding/guardian", { waitUntil: "networkidle" });
      for (let i = 0; i < 4; i++) {
        await her.click('button:has-text("Send it to him again")');
        await her.waitForTimeout(1500);
      }
      const reminded = await db.collection("guardianships").findOne({ _id: fresh._id });
      check(
        "reminders stop at the cap",
        reminded.invited.remindersSent === 3,
        String(reminded.invited.remindersSent)
      );
      check(
        "and it says what to do instead of sending a fourth",
        /telephone him|name someone else/i.test(await her.textContent("body"))
      );

      /* The expiry sweep. */
      await db
        .collection("guardianships")
        .updateOne({ _id: fresh._id }, { $set: { "invited.expiresAt": new Date(Date.now() - 1000) } });

      require("node:child_process").execFileSync(
        process.execPath,
        ["scripts/expire-invitations.cjs", "--apply"],
        { stdio: "pipe" }
      );

      const swept = await db.collection("guardianships").findOne({ _id: fresh._id });
      check("the sweep expires an unanswered invitation", swept.status === "expired");
      const entry = await db
        .collection("auditLog")
        .findOne({ "subject.id": String(fresh._id), action: "guardianship.revoked" });
      check("with an audit entry attributed to no person", !!entry && entry.actor.userId === null);

      const late = await (await browser.newContext()).newPage();
      await late.goto(String(secondLink), { waitUntil: "networkidle" });
      check(
        "and the link no longer works",
        /did not work|expired|already been answered/i.test(await late.textContent("body"))
      );
      await late.close();
    }

    /* ---------- submit for review ----------------------------------- */
    await her.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
    check(
      "an unfinished profile offers no submit button",
      (await her.locator('button:has-text("Send my profile for review")').count()) === 0
    );

    for (const [step, fill] of [
      ["basics", async () => {
        await her.fill('input[name="basics.city"]', "Montreal");
        await her.selectOption('select[name="basics.province"]', "QC");
        await her.click('label:has(input[name="basics.citizenship"][value="citizen"])');
      }],
      ["background", async () => {
        await her.click('label:has(input[name="background.maritalStatus"][value="neverMarried"])');
        await her.click('label:has(input[name="background.children"][value="none"])');
        await her.fill('input[name="background.languages"]', "English");
        await her.selectOption('select[name="education.level"]', "bachelor");
      }],
      ["deen", async () => {
        await her.click('label:has(input[name="deen.salah"][value="fiveDaily"])');
        await her.click('label:has(input[name="deen.madhhab"][value="hanafi"])');
        await her.click('label:has(input[name="deen.dress"][value="hijab"])');
      }],
      ["lookingFor", async () => {
        await her.fill('input[name="lookingFor.ageMin"]', "27");
        await her.fill('input[name="lookingFor.ageMax"]', "38");
        await her.click('label:has(input[name="lookingFor.provinces"][value="QC"])');
      }],
    ]) {
      await her.goto(`${BASE}/onboarding/${step}`, { waitUntil: "networkidle" });
      await fill();
      await her.click('button[type="submit"]');
      await her.waitForTimeout(2000);
    }

    /* She has no confirmed wali any more, so invite one last time and
       have him accept. He already has an account, which exercises the
       brother-who-is-also-a-wali path. */
    await her.goto(BASE + "/onboarding/guardian", { waitUntil: "networkidle" });
    await her.fill('input[name="name"]', "Ahmed Al-Rashid");
    await her.selectOption('select[name="relationship"]', "father");
    await her.fill('input[name="email"]', WALI);
    await her.click('button:has-text("Send his invitation")');
    await her.waitForTimeout(3000);
    const finalLink = await devLink(her);

    const back = await (await browser.newContext()).newPage();
    await back.goto(String(finalLink), { waitUntil: "networkidle" });
    await back.click('button:has-text("I accept")');
    await back.waitForTimeout(2500);
    check(
      "an existing account is told to sign in rather than set a password",
      /Sign in|already have a NikahCanada account/i.test(await back.textContent("body"))
    );
    await back.goto(BASE + "/login", { waitUntil: "networkidle" });
    await back.fill('input[name="email"]', WALI);
    await back.fill('input[name="password"]', PASSWORD);
    await back.click('button[type="submit"]');
    await back.waitForTimeout(2500);
    await back.goto(String(finalLink), { waitUntil: "networkidle" });
    await back.click('button:has-text("I accept")');
    await back.waitForTimeout(3000);
    await back.close();

    await her.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
    check("a finished profile reaches 100%", /100%/.test(await her.textContent("body")));
    check(
      "and now offers the submit button",
      (await her.locator('button:has-text("Send my profile for review")').count()) === 1
    );

    await her.click('button:has-text("Send my profile for review")');
    await her.waitForTimeout(2500);

    const submitted = await db.collection("profiles").findOne({ userId: sister._id });
    check("the profile moved to pendingReview", submitted.status === "pendingReview");
    check("and recorded when", !!submitted.submittedAt);
    /* Still "what happens next" rather than a bare thank-you — but with
       approval deferred (D1f) what happens next is that she is in the
       pool, with our checks running behind her rather than in front. */
    const afterSubmit = await her.textContent("body");
    check(
      "the screen says what happens next, not just thank you",
      /telephones|telephone you before any matching/.test(afterSubmit) &&
        /In the pool|With our team/.test(afterSubmit),
      afterSubmit.replace(/\s+/g, " ").slice(0, 140)
    );
    check(
      "and stops offering to submit again",
      (await her.locator('button:has-text("Send my profile for review")').count()) === 0
    );

    await hisCtx.close();
    await herCtx.close();
  } finally {
    await browser.close();
    for (const email of emails) {
      const u = await db.collection("users").findOne({ email });
      if (!u) continue;
      await db.collection("sessions").deleteMany({ userId: String(u._id) });
      await db.collection("verificationTokens").deleteMany({ userId: String(u._id) });
      await db.collection("guardianships").deleteMany({
        $or: [{ memberUserId: String(u._id) }, { waliUserId: String(u._id) }],
      });
      await db.collection("profiles").deleteMany({ userId: u._id });
      await db.collection("users").deleteOne({ _id: u._id });
    }
    console.log(`\ncleaned up ${emails.length} fixture accounts`);
    await mongo.close();
  }

  if (!checks) {
    console.error("\nNO CHECKS RAN — this is not a pass.");
    process.exit(1);
  }
  if (findings.length) {
    console.error(`\n${findings.length} of ${checks} FAILED:\n  - ${findings.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(`\nall ${checks} wali checks pass`);
})().catch((err) => {
  console.error("\n" + (err && err.stack));
  process.exit(1);
});
