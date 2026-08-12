/* End-to-end check of the staff review queue.
 *
 * Builds a real sister with a confirmed wali, submits her, then reviews
 * her as a real staff member with a real TOTP code. The refusals matter
 * most: a member must not reach the console, and approving a profile
 * whose wali has not confirmed must fail on the server however the form
 * is driven.
 *
 *   BASE=http://127.0.0.1:3007 node scripts/review-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { createHmac, createHash, randomBytes } = require("node:crypto");
const argon2 = require("@node-rs/argon2");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";

const STAMP = Date.now();
const PASSWORD = "a-long-enough-passphrase";
const SISTER = `review+sister${STAMP}@example.invalid`;
const WALI = `review+wali${STAMP}@example.invalid`;
const STAFF = `review+staff${STAMP}@example.invalid`;
const emails = [SISTER, WALI, STAFF];

const findings = [];
let checks = 0;
function check(name, ok, detail = "") {
  checks++;
  if (!ok) findings.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "pass " : "FAIL "} ${name}${detail && !ok ? `  (${detail})` : ""}`);
  return ok;
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function totp(secret, atMs = Date.now()) {
  let bits = 0, value = 0;
  const bytes = [];
  for (const c of secret.toUpperCase()) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const counter = Math.floor(atMs / 30000);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const d = createHmac("sha1", Buffer.from(bytes)).update(buf).digest();
  const o = d[d.length - 1] & 0x0f;
  const n = ((d[o] & 0x7f) << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3];
  return String(n % 1e6).padStart(6, "0");
}

async function devLink(page) {
  const links = page.locator('a[href*="token="]');
  return (await links.count()) ? links.first().getAttribute("href") : null;
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
    /* ---------- a sister, complete, with a confirmed wali ------------ */
    const herCtx = await browser.newContext();
    const her = await herCtx.newPage();
    await her.goto(BASE + "/register", { waitUntil: "networkidle" });
    await assertOurApp(her);
    await her.click('label:has(input[name="gender"][value="sister"])');
    await her.fill('input[name="firstName"]', "Fatima");
    await her.fill('input[name="lastName"]', "Fixture");
    await fillDob(her, "1995-04-12");
    await her.fill('input[name="email"]', SISTER);
    await her.fill('input[name="password"]', PASSWORD);
    await her.check('input[name="marriageIntention"]');
    await her.check('input[name="terms"]');
    await her.click('button[type="submit"]');
    await her.waitForURL("**/onboarding", { timeout: 20_000 });

    for (const [step, fill] of [
      ["basics", async () => {
        await her.fill('input[name="basics.city"]', "Montreal");
        await her.selectOption('select[name="basics.province"]', "QC");
        await her.click('label:has(input[name="basics.citizenship"][value="citizen"])');
      }],
      ["background", async () => {
        await her.click('label:has(input[name="background.maritalStatus"][value="neverMarried"])');
        await her.click('label:has(input[name="background.children"][value="none"])');
        await her.fill('input[name="background.languages"]', "English, Arabic");
        await her.selectOption('select[name="education.level"]', "bachelor");
      }],
      ["deen", async () => {
        await her.click('label:has(input[name="deen.salah"][value="fiveDaily"])');
        await her.click('label:has(input[name="deen.madhhab"][value="hanafi"])');
        await her.click('label:has(input[name="deen.dress"][value="hijab"])');
        await her.fill('textarea[name="freeText.aboutMe"]', "A short paragraph in her own words.");
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
      await her.waitForTimeout(1800);
    }

    /* Submit is refused while her wali has not confirmed. */
    await her.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
    check(
      "she cannot submit while her wali is missing",
      (await her.locator('button:has-text("Send my profile for review")').count()) === 0
    );

    await her.goto(BASE + "/onboarding/guardian", { waitUntil: "networkidle" });
    await her.fill('input[name="name"]', "Ahmed Al-Rashid");
    await her.selectOption('select[name="relationship"]', "father");
    await her.fill('input[name="email"]', WALI);
    await her.click('button[type="submit"]');
    await her.waitForTimeout(3000);
    const invite = await devLink(her);

    const him = await (await browser.newContext()).newPage();
    await him.goto(String(invite), { waitUntil: "networkidle" });
    await him.fill('input[name="password"]', PASSWORD);
    await him.click('button[type="submit"]');
    await him.waitForURL("**/login**", { timeout: 20_000 });

    await her.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
    await her.click('button:has-text("Send my profile for review")');
    await her.waitForTimeout(2500);

    const sisterUser = await db.collection("users").findOne({ email: SISTER });
    const profile = await db.collection("profiles").findOne({ userId: sisterUser._id });
    check("she is in the queue", profile.status === "pendingReview");
    const profileId = profile._id.toHexString();

    /* ---------- a member must not reach the console ----------------- */
    await her.goto(BASE + "/admin", { waitUntil: "networkidle" });
    check(
      "a member is turned away from the console",
      new URL(her.url()).pathname === "/onboarding",
      her.url()
    );
    await her.goto(`${BASE}/admin/members/${profileId}`, { waitUntil: "networkidle" });
    check(
      "and cannot open a member page directly",
      new URL(her.url()).pathname === "/onboarding",
      her.url()
    );

    /* The wali is not staff either. */
    await him.goto(BASE + "/login", { waitUntil: "networkidle" });
    await him.fill('input[name="email"]', WALI);
    await him.fill('input[name="password"]', PASSWORD);
    await him.click('button[type="submit"]');
    await him.waitForTimeout(2500);
    await him.goto(BASE + "/admin", { waitUntil: "networkidle" });
    check("a wali is turned away too", new URL(him.url()).pathname !== "/admin", him.url());

    /* ---------- a real staff member --------------------------------- */
    const staffId = new ObjectId();
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    await db.collection("users").insertOne({
      _id: staffId,
      email: STAFF,
      emailVerifiedAt: new Date(),
      passwordHash: await argon2.hash(PASSWORD, {
        algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1,
      }),
      roles: ["staff"],
      status: "active",
      locale: "en-CA",
      legalName: { first: "Staff", last: "Fixture" },
      phone: null,
      dateOfBirth: null,
      mfa: { enabled: true, secret },
      lastLoginAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      tokenVersion: 0,
      closedAt: null,
      closureReason: null,
    });

    const s = await (await browser.newContext()).newPage();
    await s.goto(BASE + "/login?next=/admin", { waitUntil: "networkidle" });
    await s.fill('input[name="email"]', STAFF);
    await s.fill('input[name="password"]', PASSWORD);
    await s.click('button[type="submit"]');
    await s.waitForURL("**/mfa**", { timeout: 45_000 }).catch(() => {});
    await s.waitForSelector('input[name="code"]', { timeout: 45_000 });
    await s.fill('input[name="code"]', totp(secret));
    await s.click('button[type="submit"]');
    /* Waited on rather than slept through: the console is a cold route
       on a fresh dev server and takes longer to compile than any fixed
       pause, which then reads as "the second factor was refused". */
    await s.waitForURL("**/admin", { timeout: 60_000 }).catch(() => {});
    await s.waitForLoadState("networkidle").catch(() => {});
    check("staff land in the console after the second factor", new URL(s.url()).pathname === "/admin", s.url());

    const queue = await s.textContent("body");
    check("her row is in the queue", /F\.F|Sister/.test(queue));
    check(
      "the queue shows initials, not a legal name",
      !/Fatima/.test(queue) && !/Fixture/.test(queue.replace(/Staff Fixture/g, ""))
    );

    await s.goto(`${BASE}/admin/members/${profileId}`, { waitUntil: "networkidle" });
    const page360 = await s.textContent("body");
    check("the member page shows her answers", /Montreal/.test(page360) && /Hanafi/.test(page360));
    check("it shows her wali as confirmed", /Ahmed Al-Rashid/.test(page360));
    check("it shows the audit history", /profile\.|Nothing recorded/.test(page360));

    /* ---------- the checks are opened at submission ------------------ */
    {
      const opened = await db
        .collection("verifications")
        .find({ "subject.userId": String(sisterUser._id) })
        .toArray();
      check("submitting opened her checks", opened.length === 2, `${opened.length} opened`);
      check(
        "a sister gets identity and the intake call, not a reference",
        opened.map((v) => v.kind).sort().join(",") === "identity,intakeCall"
      );

      const page = await s.textContent("body");
      check("the member page lists them", /Intake call/.test(page) && /Identity/.test(page));
      check(
        "and says why a document cannot be uploaded yet",
        /object storage/i.test(page)
      );
      check("approval is blocked by the outstanding checks", /Checks outstanding/.test(page));
    }

    /* ---------- approving before the checks is refused --------------- */
    await s.click('label:has(input[name="decision"][value="live"])');
    await s.click('button:has-text("Record the decision")');
    await s.waitForTimeout(2500);
    check(
      "approving with checks outstanding is refused on the server",
      /Checks outstanding/i.test(await s.textContent("body"))
    );
    check(
      "and she stayed in the queue",
      (await db.collection("profiles").findOne({ _id: profile._id })).status === "pendingReview"
    );

    /* ---------- doing the checks ------------------------------------- */
    {
      const [identity, intake] = await db
        .collection("verifications")
        .find({ "subject.userId": String(sisterUser._id) })
        .sort({ kind: 1 })
        .toArray();

      /* The intake call must be arranged before it can be marked done. */
      await s.goto(`${BASE}/admin/members/${profileId}`, { waitUntil: "networkidle" });
      await s.fill('input[name="scheduledFor"]', "2026-08-20");
      await s.click('button:has-text("Arrange the call")');
      await s.waitForTimeout(2500);

      const arranged = await db.collection("verifications").findOne({ _id: intake._id });
      check("the intake call was arranged", !!arranged.call?.scheduledFor);

      await s.goto(`${BASE}/admin/members/${profileId}`, { waitUntil: "networkidle" });
      await s.click('button:has-text("Mark the call done")');
      await s.waitForTimeout(2500);
      const done = await db.collection("verifications").findOne({ _id: intake._id });
      check("and marked done, with who did it", !!done.call?.completedAt && !!done.call?.staffUserId);

      /* Approve both checks straight in the database is not the point —
         drive the forms, because that is what staff will do. */
      for (const _ of [0, 1]) {
        await s.goto(`${BASE}/admin/members/${profileId}`, { waitUntil: "networkidle" });
        const selects = s.locator('select[name="outcome"]');
        if ((await selects.count()) === 0) break;
        await selects.first().selectOption("approve");
        await s.locator('button:has-text("Record")').first().click();
        await s.waitForTimeout(2500);
      }

      const after = await db
        .collection("verifications")
        .find({ "subject.userId": String(sisterUser._id) })
        .toArray();
      check(
        "both checks are approved",
        after.every((v) => v.decision === "approved"),
        after.map((v) => `${v.kind}:${v.decision}`).join(" ")
      );
      check(
        "the identity document was deleted with the decision",
        after.filter((v) => v.kind === "identity").every((v) => v.documents.every((d) => d.deletedAt))
      );
      void identity;
    }

    /* ---------- her wali still has to be checked (D10) --------------- */
    await s.goto(`${BASE}/admin/members/${profileId}`, { waitUntil: "networkidle" });
    await s.click('label:has(input[name="decision"][value="live"])');
    await s.click('button:has-text("Record the decision")');
    await s.waitForTimeout(2500);
    check(
      "approving is still refused while her wali is unchecked",
      /wali has not been identity-checked/i.test(await s.textContent("body"))
    );

    await s.goto(`${BASE}/admin/members/${profileId}`, { waitUntil: "networkidle" });
    await s.click('button:has-text("Record that he is verified")');
    await s.waitForTimeout(2000);
    check(
      "verifying him needs a method, not just a click",
      /how he was checked/i.test(await s.textContent("body"))
    );

    await s.fill('input[name="method"]', "Spoke to him and saw his ID over video");
    await s.click('button:has-text("Record that he is verified")');
    await s.waitForTimeout(2500);
    const g = await db.collection("guardianships").findOne({ memberUserId: String(sisterUser._id) });
    check("his check is recorded with the method", g.verification.state === "verified" && !!g.verification.method);

    /* ---------- declining needs a reason ---------------------------- */
    await s.click('label:has(input[name="decision"][value="rejected"])');
    /* By name, not by type. The console header carries a sign-out form,
       so `button[type="submit"]` is the sign-out button — clicking it
       signed the reviewer out and every check after it failed for a
       reason that had nothing to do with the code under test. */
    await s.click('button:has-text("Record the decision")');
    await s.waitForTimeout(2500);
    check("declining without a reason is refused", /Give a reason/i.test(await s.textContent("body")));
    const undecided = await db.collection("profiles").findOne({ _id: profile._id });
    check("and nothing changed", undecided.status === "pendingReview");

    /* ---------- approving works, now that everything is done -------- */
    await s.goto(`${BASE}/admin/members/${profileId}`, { waitUntil: "networkidle" });
    await s.click('label:has(input[name="decision"][value="live"])');
    await s.click('button:has-text("Record the decision")');
    await s.waitForTimeout(3000);
    const decided = await db.collection("profiles").findOne({ _id: profile._id });
    check("approving takes her live", decided.status === "live", decided.status);
    check("and records who decided", decided.decidedBy === staffId.toHexString());
    check("and when", !!decided.decidedAt && !!decided.liveAt);

    const audit = await db.collection("auditLog").find({ "subject.id": profileId }).toArray();
    check("the decision was logged", audit.some((e) => e.action === "profile.approved"));
    check("with the staff member as actor", audit.some((e) => e.actor?.userId === staffId.toHexString()));

    /* ---------- and cannot be decided twice ------------------------- */
    await s.reload({ waitUntil: "networkidle" });
    check(
      "an already-decided profile offers no second decision",
      /Already decided/.test(await s.textContent("body"))
    );

    /* ---------- approving without a wali is refused server-side ----- */
    {
      const brotherEmail = `review+b${STAMP}@example.invalid`;
      emails.push(brotherEmail);
      const b = await (await browser.newContext()).newPage();
      await b.goto(BASE + "/register", { waitUntil: "networkidle" });
      await b.click('label:has(input[name="gender"][value="brother"])');
      await b.fill('input[name="firstName"]', "Yusuf");
      await fillDob(b, "1993-01-05");
      await b.fill('input[name="email"]', brotherEmail);
      await b.fill('input[name="password"]', PASSWORD);
      await b.check('input[name="marriageIntention"]');
      await b.check('input[name="terms"]');
      await b.click('button[type="submit"]');
      await b.waitForURL("**/onboarding", { timeout: 20_000 });

      const bu = await db.collection("users").findOne({ email: brotherEmail });
      const bp = await db.collection("profiles").findOne({ userId: bu._id });
      /* Forced into the queue with an empty profile, which is exactly
         what the server-side re-check exists to catch. */
      await db.collection("profiles").updateOne(
        { _id: bp._id },
        { $set: { status: "pendingReview", submittedAt: new Date() } }
      );

      await s.goto(`${BASE}/admin/members/${bp._id.toHexString()}`, { waitUntil: "networkidle" });
      check("an unfinished profile is flagged as not ready", /Not ready/.test(await s.textContent("body")));
      await s.click('label:has(input[name="decision"][value="live"])');
      await s.click('button:has-text("Record the decision")');
      await s.waitForTimeout(2500);
      check(
        "approving it is refused on the server",
        /Not ready|cannot go live/i.test(await s.textContent("body"))
      );
      const stillPending = await db.collection("profiles").findOne({ _id: bp._id });
      check("and it stayed in the queue", stillPending.status === "pendingReview");
      await b.close();
    }
  } finally {
    await browser.close();
    for (const email of emails) {
      const u = await db.collection("users").findOne({ email });
      if (!u) continue;
      const profs = await db.collection("profiles").find({ userId: u._id }).toArray();
      for (const pr of profs) await db.collection("auditLog").deleteMany({ "subject.id": pr._id.toHexString() });
      await db.collection("sessions").deleteMany({ userId: String(u._id) });
      await db.collection("verificationTokens").deleteMany({ userId: String(u._id) });
      await db.collection("guardianships").deleteMany({
        $or: [{ memberUserId: String(u._id) }, { waliUserId: String(u._id) }],
      });
      await db.collection("verifications").deleteMany({ "subject.userId": String(u._id) });
      await db.collection("profiles").deleteMany({ userId: u._id });
      await db.collection("auditLog").deleteMany({ "subject.id": String(u._id) });
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
  console.log(`\nall ${checks} review checks pass`);
})().catch((err) => {
  console.error("\n" + (err && err.stack));
  process.exit(1);
});
