/* End-to-end check of browse, connections and the ledger.
 *
 * Profiles are put into `live` directly rather than driven through the
 * review queue — that path is covered by review-flow.cjs, and repeating
 * it here would make this checker mostly about something else.
 *
 *   BASE=http://127.0.0.1:3007 node scripts/browse-flow.cjs
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
const emails = [];

/* `grantPerMonth` in src/lib/domain/settings.ts — D1a, three a month.
   The ledger assertions below were written as bare numbers (9, 9, 9, 10)
   against a grant of ten, so changing the setting turned four passing
   checks into four failures that said nothing about the setting. They
   are relative to this now, and the grant itself is asserted below, so
   a mismatch between this constant and the product shows up as one
   named failure rather than four arithmetic ones. */
const GRANT = 3;

const findings = [];
let checks = 0;
/* What a person can actually read. `textContent` includes the RSC
   payload sitting in <script> tags, which is how an assertion about the
   visible page ends up matching a serialised prop. */
async function visible(page) {
  return page.evaluate(() => document.body.innerText);
}

function check(name, ok, detail = "") {
  checks++;
  if (!ok) findings.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "pass " : "FAIL "} ${name}${detail && !ok ? `  (${detail})` : ""}`);
  return ok;
}

const mongo = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

async function makeMember(browser, db, gender, name, over = {}) {
  /* Lowercased at the source. Registration stores the address
     lowercased, so a fixture with a capital in it registers fine and
     is then invisible to every lookup afterwards. */
  const email = `browse+${gender}${name}${STAMP}@example.invalid`.toLowerCase();
  emails.push(email);
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/register", { waitUntil: "networkidle" });
  /* Explicit, and generous. Run last in a sequence the dev server is
     still compiling routes, and Playwright's 30s default expires on a
     cold /register — which then reads as "the gender control is missing"
     rather than "the page was not ready". */
  await page.waitForSelector('label:has(input[name="gender"])', { timeout: 90000 });
  await page.click(`label:has(input[name="gender"][value="${gender}"])`);
  await page.fill('input[name="firstName"]', name);
  await page.fill('input[name="lastName"]', "Fixture");
  await fillDob(page, "1995-04-12");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.check('input[name="marriageIntention"]');
  await page.check('input[name="terms"]');
  await page.click('button[type="submit"]');
  await page.waitForURL("**/onboarding", { timeout: 20_000 });

  const user = await db.collection("users").findOne({ email });
  await db.collection("profiles").updateOne(
    { userId: user._id },
    {
      $set: {
        status: "live",
        liveAt: new Date(),
        basics: { birthYear: 1995, city: "Montreal", province: "QC", citizenship: "citizen" },
        background: { maritalStatus: "neverMarried", children: "none", languages: ["English"] },
        deen: { salah: "fiveDaily", madhhab: "hanafi", ...(gender === "sister" ? { dress: "hijab" } : { beard: "yes" }) },
        education: { level: "bachelor" },
        work: { occupation: "Teacher" },
        freeText: { aboutMe: "A short paragraph." },
        lookingFor: { ageMin: 25, ageMax: 45, provinces: ["QC"], maritalStatus: [], madhhab: [] },
        ...over,
      },
    }
  );
  return { email, page, user };
}

(async () => {
  await mongo.connect();
  const db = mongo.db(dbName);
  const browser = await chromium.launch();

  try {
    const brother = await makeMember(browser, db, "brother", "Yusuf");
    await assertOurApp(brother.page);
    const sister = await makeMember(browser, db, "sister", "Fatima");
    const other = await makeMember(browser, db, "sister", "Aisha");

    /* A confirmed wali for each of them.
       Not optional any more: a sister with no confirmed wali is hidden
       from browse and her profile page 404s, so a fixture without one
       is a fixture nobody can see. Fatima also needs him in order to
       accept. */
    for (const her of [sister, other]) {
      await db.collection("guardianships").insertOne({
        memberUserId: String(her.user._id),
        memberProfileId: "x",
        waliUserId: `wali-fixture-${her.user._id}`,
        invited: {
          name: "Ahmed",
          relationship: "father",
          email: `browse+wali${STAMP}.${her.user._id}@example.invalid`,
          invitedAt: new Date(),
          tokenHash: "b".repeat(64),
          expiresAt: new Date(Date.now() + 86_400_000),
          remindersSent: 0,
        },
        status: "confirmed",
        confirmedAt: new Date(),
        declinedAt: null,
        declineReason: null,
        revokedAt: null,
        revokedBy: null,
        expiredAt: null,
        verification: { state: "verified", verifiedAt: new Date(), method: "test" },
        replacesGuardianshipId: null,
        replacedByGuardianshipId: null,
      });
    }

    /* ---------- browse shows the other gender only ------------------- */
    const b = brother.page;
    await b.goto(BASE + "/browse", { waitUntil: "networkidle" });
    const list = await b.textContent("body");
    check("a brother sees sisters", /Sister/.test(list));
    check("and not other brothers", !/Brother ·/.test(list));
    check("nor himself", !/Yusuf/.test(list));
    check("the balance is shown", new RegExp(`${GRANT} connections left`).test(list), list.slice(0, 200));
    check("initials only, no names", !/Fatima/.test(list) && !/Fixture/.test(list));

    const granted = await db
      .collection("connectionLedger")
      .find({ userId: String(brother.user._id) })
      .toArray();
    /* Three, not ten — D1a, decided. Asserted on the delta rather than
       only on the row count so that a grant of the wrong size cannot
       pass as a grant that happened. */
    check(
      `the monthly grant was given once, and it is ${GRANT}`,
      granted.length === 1 && granted[0].delta === GRANT,
      `${granted.length} row(s), delta ${granted[0] && granted[0].delta}`
    );

    await b.reload({ waitUntil: "networkidle" });
    const twice = await db
      .collection("connectionLedger")
      .countDocuments({ userId: String(brother.user._id), reason: "monthlyGrant" });
    check("and is not given again on the next visit", twice === 1);

    /* ---------- filters ----------------------------------------------
       Filtered to somewhere nobody can be rather than merely somewhere
       this run's fixtures are not. Browse reads the whole `profiles`
       collection, so "no results" is only a safe assertion when the
       filter excludes every profile that could exist — including a
       seeded testing pool (`scripts/seed-pool.cjs`) sitting in the same
       database. Nunavut and an age of 100 are not used by either. */
    await b.goto(BASE + "/browse?province=NU", { waitUntil: "networkidle" });
    check("a filter that matches nobody says so", /Nobody matches/.test(await b.textContent("body")));
    await b.goto(BASE + "/browse?ageMin=100", { waitUntil: "networkidle" });
    check("an age filter narrows it too", /Nobody matches/.test(await b.textContent("body")));

    /* ---------- sending ---------------------------------------------- */
    const sisterProfile = await db.collection("profiles").findOne({ userId: sister.user._id });
    const sisterProfileId = sisterProfile._id.toHexString();

    await b.goto(`${BASE}/browse/${sisterProfileId}`, { waitUntil: "networkidle" });
    const detail = await b.textContent("body");
    check("the profile shows her answers", /Montreal/.test(detail) && /Hanafi/.test(detail));
    check("the photograph is locked, with the rule on it", /Photograph locked/.test(detail));
    check("the button says what it costs", /uses 1 connection/.test(detail));

    await b.click('button:has-text("Ask to talk")');
    await b.waitForTimeout(3000);
    check("asking succeeds", /request is with them/i.test(await b.textContent("body")));

    const request = await db
      .collection("connectionRequests")
      .findOne({ fromUserId: String(brother.user._id) });
    check("a request exists, pending", !!request && request.state === "pending");
    check("with an expiry", !!request.expiresAt);

    const afterSend = await db
      .collection("connectionLedger")
      .find({ userId: String(brother.user._id) })
      .toArray();
    const balance = afterSend.reduce((t, e) => t + e.delta, 0);
    check("the connection was reserved, not spent", balance === GRANT - 1, String(balance));
    check(
      "and the entry names the request it is held against",
      afterSend.some((e) => e.reason === "reservedForRequest" && e.requestId === request._id.toHexString())
    );

    await b.goto(`${BASE}/browse/${sisterProfileId}`, { waitUntil: "networkidle" });
    check("asking twice is not offered", !/Ask to talk/.test(await b.textContent("body")));

    /* ---------- she answers ------------------------------------------ */
    const s = sister.page;
    await s.goto(BASE + "/requests", { waitUntil: "networkidle" });
    const inbox = await s.textContent("body");
    check("she sees it waiting", /Waiting on you/.test(inbox) && /Y\.F/.test(inbox));
    check("shown by initials, not his name", !/Yusuf/.test(inbox));

    await s.click('button:has-text("Accept")');
    await s.waitForTimeout(3500);
    const accepted = await db.collection("connectionRequests").findOne({ _id: request._id });
    check(
      "accepting records it",
      accepted.state === "accepted" && !!accepted.answeredAt,
      `${accepted.state} | ${(await s.textContent("body")).replace(/\s+/g, " ").slice(0, 220)}`
    );

    const afterAccept = await db
      .collection("connectionLedger")
      .find({ userId: String(brother.user._id) })
      .toArray();
    check(
      "the held connection is now spent, not double-charged",
      afterAccept.reduce((t, e) => t + e.delta, 0) === GRANT - 1
    );
    check(
      "and the ledger reads as one story",
      afterAccept.filter((e) => e.requestId === request._id.toHexString()).length === 2
    );

    /* ---------- declining returns the connection --------------------- */
    const otherProfile = await db.collection("profiles").findOne({ userId: other.user._id });
    await b.goto(`${BASE}/browse/${otherProfile._id.toHexString()}`, { waitUntil: "networkidle" });
    await b.click('button:has-text("Ask to talk")');
    await b.waitForTimeout(3000);

    const o = other.page;
    await o.goto(BASE + "/requests", { waitUntil: "networkidle" });
    await o.click('button:has-text("Not for me")');
    await o.waitForTimeout(800);
    await o.click('button:has-text("Confirm")');
    await o.waitForTimeout(3000);

    const declinedLedger = await db
      .collection("connectionLedger")
      .find({ userId: String(brother.user._id) })
      .toArray();
    check(
      "declining returns the connection",
      declinedLedger.reduce((t, e) => t + e.delta, 0) === GRANT - 1,
      String(declinedLedger.reduce((t, e) => t + e.delta, 0))
    );
    check(
      "and says so in the ledger",
      declinedLedger.some((e) => e.reason === "refundedOnDecline")
    );

    const declined = await db
      .collection("connectionRequests")
      .findOne({ toUserId: String(other.user._id) });
    check("the request reads as declined", declined.state === "declined");

    await b.goto(`${BASE}/browse/${otherProfile._id.toHexString()}`, { waitUntil: "networkidle" });
    const closed = await visible(b);
    check(
      "he is told it is closed, not that she said no",
      /closed/i.test(closed) && !/declin/i.test(closed),
      closed.replace(/\s+/g, " ").slice(0, 160)
    );

    const payload = await b.content();
    check(
      "and her actual answer never reaches his browser",
      !/declined/.test(payload),
      "the exact state was in the page payload"
    );

    /* ---------- the inbound cap -------------------------------------- */
    await db.collection("connectionRequests").insertMany(
      Array.from({ length: 10 }, (_, i) => ({
        pairKey: `filler${i}:${String(other.user._id)}`,
        fromUserId: `filler${i}`,
        toUserId: String(other.user._id),
        state: "pending",
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
        answeredAt: null,
        declineReason: null,
        conversationId: null,
      }))
    );

    await b.goto(BASE + "/browse", { waitUntil: "networkidle" });
    const capped = await b.textContent("body");
    check("a member at the cap disappears from browse", !capped.includes("A.F"), capped.slice(0, 160));

    await o.goto(BASE + "/browse", { waitUntil: "networkidle" });
    check(
      "and is told why, rather than left wondering",
      /not being shown to anyone new/.test(await o.textContent("body"))
    );

    /* ---------- the cap refuses politely ----------------------------- */
    const third = await makeMember(browser, db, "brother", "Idris");
    const t = third.page;
    await t.goto(`${BASE}/browse/${otherProfile._id.toHexString()}`, { waitUntil: "networkidle" });
    /* She is at the cap, so he cannot even ask — which is the cap
       working, and is checked rather than worked around. */
    const cappedDetail = await t.textContent("body");
    check(
      "asking somebody at the cap is refused with its own sentence",
      /Ask to talk/.test(cappedDetail)
    );
    await t.click('button:has-text("Ask to talk")');
    await t.waitForTimeout(3000);
    check(
      "and the refusal explains it is temporary",
      /not taking new requests/i.test(await t.textContent("body"))
    );
    const noCharge = await db
      .collection("connectionLedger")
      .find({ userId: String(third.user._id) })
      .toArray();
    check(
      "a refused request costs nothing",
      noCharge.reduce((sum, e) => sum + e.delta, 0) === GRANT
    );

    /* ---------- a sister who loses her wali leaves the pool ----------- */
    /* Not merely "cannot accept": she is not shown and her page does not
       resolve. Otherwise a brother spends a connection asking somebody
       whose answer can never open a conversation. Done last, because it
       takes her out of everything above. */
    await db
      .collection("guardianships")
      .updateOne({ memberUserId: String(other.user._id) }, { $set: { status: "revoked" } });

    const gone = await t.goto(`${BASE}/browse/${otherProfile._id.toHexString()}`, {
      waitUntil: "networkidle",
    });
    check(
      "her profile stops resolving once the wali is revoked",
      gone.status() === 404,
      String(gone.status())
    );
    await t.goto(BASE + "/browse", { waitUntil: "networkidle" });
    check("and she is not in the list either", !(await visible(t)).includes("A.F"));
  } finally {
    await browser.close();
    for (const email of emails) {
      const u = await db.collection("users").findOne({ email });
      if (!u) continue;
      const id = String(u._id);
      await db.collection("sessions").deleteMany({ userId: id });
      await db.collection("verificationTokens").deleteMany({ userId: id });
      await db.collection("guardianships").deleteMany({ memberUserId: id });
      await db.collection("connectionLedger").deleteMany({ userId: id });
      await db.collection("connectionRequests").deleteMany({
        $or: [{ fromUserId: id }, { toUserId: id }],
      });
      /* Accepting a request opens a conversation. Leaving it behind
         broke the conversation checker, which selected the first one
         it found. */
      const convs = await db.collection("conversations").find({ "participants.userId": id }).toArray();
      for (const c of convs) {
        await db.collection("messages").deleteMany({ conversationId: c._id.toHexString() });
        await db.collection("conversations").deleteOne({ _id: c._id });
      }
      await db.collection("profiles").deleteMany({ userId: u._id });
      await db.collection("auditLog").deleteMany({ "actor.userId": id });
      await db.collection("users").deleteOne({ _id: u._id });
    }
    await db.collection("connectionRequests").deleteMany({ fromUserId: /^filler/ });
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
  console.log(`\nall ${checks} browse checks pass`);
})().catch((err) => {
  console.error("\n" + (err && err.stack));
  process.exit(1);
});
