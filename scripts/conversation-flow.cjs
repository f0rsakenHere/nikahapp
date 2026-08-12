/* End-to-end check of the conversation and the wali's gate.
 *
 * This is the part of the product with no equivalent elsewhere: a
 * private thread that a third person reads in full, by design. So the
 * checks lean on the gate and on who can see what — a conversation that
 * opens without approval, or that another family's wali can read, is not
 * a bug in a feature, it is the promise broken.
 *
 *   BASE=http://127.0.0.1:3007 node scripts/conversation-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";

const STAMP = Date.now();
const PASSWORD = "a-long-enough-passphrase";
const emails = [];

const findings = [];
let checks = 0;
function check(name, ok, detail = "") {
  checks++;
  if (!ok) findings.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "pass " : "FAIL "} ${name}${detail && !ok ? `  (${detail})` : ""}`);
  return ok;
}

async function visible(page) {
  return page.evaluate(() => document.body.innerText);
}

const mongo = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

async function member(browser, db, gender, name) {
  const email = `conv+${gender}${name}${STAMP}@example.invalid`.toLowerCase();
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
        lookingFor: { ageMin: 25, ageMax: 45, provinces: ["QC"], maritalStatus: [], madhhab: [] },
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
    const him = await member(browser, db, "brother", "Yusuf");
    await assertOurApp(him.page);
    const her = await member(browser, db, "sister", "Fatima");

    /* Her wali, with a real account so he can sign in. */
    const waliEmail = `conv+wali${STAMP}@example.invalid`.toLowerCase();
    emails.push(waliEmail);
    const waliPage = await (await browser.newContext()).newPage();
    await her.page.goto(BASE + "/onboarding/guardian", { waitUntil: "networkidle" });
    await her.page.fill('input[name="name"]', "Ahmed Al-Rashid");
    await her.page.selectOption('select[name="relationship"]', "father");
    await her.page.fill('input[name="email"]', waliEmail);
    await her.page.click('button:has-text("Send his invitation")');
    await her.page.waitForTimeout(3000);
    const link = await her.page.locator('a[href*="token="]').first().getAttribute("href");
    await waliPage.goto(String(link), { waitUntil: "networkidle" });
    await waliPage.fill('input[name="password"]', PASSWORD);
    await waliPage.click('button[type="submit"]');
    await waliPage.waitForURL("**/login**", { timeout: 20_000 });
    await waliPage.fill('input[name="email"]', waliEmail);
    await waliPage.fill('input[name="password"]', PASSWORD);
    await waliPage.click('button[type="submit"]');
    await waliPage.waitForTimeout(2500);

    /* ---------- he asks, she accepts --------------------------------- */
    const herProfile = await db.collection("profiles").findOne({ userId: her.user._id });
    await him.page.goto(`${BASE}/browse/${herProfile._id.toHexString()}`, { waitUntil: "networkidle" });
    await him.page.click('button:has-text("Ask to talk")');
    await him.page.waitForTimeout(3000);

    await her.page.goto(BASE + "/requests", { waitUntil: "networkidle" });
    await her.page.click('button:has-text("Accept")');
    await her.page.waitForTimeout(3500);

    /* By the request it belongs to. `findOne({})` returns whichever
       document the server hands back first, so a conversation another
       checker forgot to clean up gets picked up instead — which fails
       here as a product bug and passes when run alone. */
    const request = await db
      .collection("connectionRequests")
      .findOne({ fromUserId: String(him.user._id), toUserId: String(her.user._id) });
    check("his request exists", !!request);
    const conversation = await db
      .collection("conversations")
      .findOne({ requestId: request._id.toHexString() });
    check("accepting creates a conversation", !!conversation);
    check("it waits on the wali, and is not open", conversation.state === "awaitingWali");
    check("it has not opened", conversation.openedAt === null);
    check(
      "with three seats: two members and him",
      conversation.participants.length === 3 &&
        conversation.participants.filter((p) => p.role === "member").length === 2
    );
    check(
      "and he is read-only by default (D6)",
      conversation.participants.find((p) => p.role === "wali").canWrite === false
    );

    const cid = conversation._id.toHexString();

    /* ---------- nothing can be said before he approves --------------- */
    await him.page.goto(`${BASE}/conversations/${cid}`, { waitUntil: "networkidle" });
    const beforeApproval = await visible(him.page);
    check("he can see the thread exists", /Conversation/.test(beforeApproval));
    check("and is told it is waiting on the wali", /opens when he approves/i.test(beforeApproval));
    check(
      "with no way to write in it",
      (await him.page.locator('textarea[name="body"]').count()) === 0
    );

    /* The banner is not dismissible, and it is there from the start.
       His *role* is asserted alongside his name: named alone he reads as
       a third person in the room, and a member looking at his own thread
       asked why he was talking to a man. */
    check(
      "the wali is named in a banner, with his role",
      /Ahmed Al-Rashid/.test(beforeApproval) &&
        /the wali/i.test(beforeApproval) &&
        /reads every message/i.test(beforeApproval)
    );

    /* ---------- another family's wali cannot read it ----------------- */
    {
      const stranger = await member(browser, db, "sister", "Aisha");
      const s = stranger.page;
      const res = await s.goto(`${BASE}/conversations/${cid}`, { waitUntil: "networkidle" });
      check("a stranger gets a 404, not a thread", res.status() === 404, String(res.status()));
      await s.close();
    }

    /* ---------- he approves ------------------------------------------ */
    await waliPage.goto(BASE + "/wali", { waitUntil: "networkidle" });
    const portal = await visible(waliPage);
    /* Case-insensitive: `innerText` applies CSS text-transform, so a
   heading styled uppercase comes back uppercase. */
    check("his portal puts it first, as waiting on him", /waiting on you/i.test(portal));
    check("and says nothing has been said yet", /Nothing has been said|nothing can be until you approve/i.test(portal));

    await waliPage.click('button:has-text("Approve, and read what they say")');
    await waliPage.waitForTimeout(3000);

    const opened = await db.collection("conversations").findOne({ _id: conversation._id });
    check("approving opens it", opened.state === "open" && !!opened.openedAt);

    const systemMessages = await db
      .collection("messages")
      .find({ conversationId: cid, kind: "system" })
      .toArray();
    check("and writes a line into the thread saying so", systemMessages.length === 1);
    check(
      "naming him, with no author",
      systemMessages[0].body.includes("Ahmed Al-Rashid") && systemMessages[0].fromUserId === null
    );

    /* ---------- talking ---------------------------------------------- */
    await him.page.goto(`${BASE}/conversations/${cid}`, { waitUntil: "networkidle" });
    await him.page.fill('textarea[name="body"]', "Assalamu alaikum. Thank you for accepting.");
    await him.page.click('button:has-text("Send")');
    await him.page.waitForTimeout(3000);

    const messages = await db.collection("messages").find({ conversationId: cid }).toArray();
    check("a message is stored", messages.length === 2);
    check(
      "with no field in which an edit could be recorded",
      !("editedAt" in messages[1]) && !("deletedAt" in messages[1])
    );

    const counted = await db.collection("conversations").findOne({ _id: conversation._id });
    check("the conversation counts it", counted.messageCount === 2 && !!counted.lastMessageAt);

    check(
      "the composer says messages cannot be edited or deleted",
      /cannot be edited or deleted/i.test(await visible(him.page))
    );

    /* ---------- the wali reads it, and cannot write ------------------ */
    await waliPage.goto(`${BASE}/conversations/${cid}`, { waitUntil: "networkidle" });
    const waliView = await visible(waliPage);
    check("the wali reads what was said", /Thank you for accepting/.test(waliView));
    check("and is told he does not write in it", /You read this conversation/.test(waliView));
    check(
      "with no composer at all",
      (await waliPage.locator('textarea[name="body"]').count()) === 0
    );

    /* ---------- staff read it, and it is recorded -------------------- */
    {
      const staffEmail = `conv+staff${STAMP}@example.invalid`.toLowerCase();
      emails.push(staffEmail);
      const argon2 = require("@node-rs/argon2");
      const staffId = new ObjectId();
      await db.collection("users").insertOne({
        _id: staffId,
        email: staffEmail,
        emailVerifiedAt: new Date(),
        passwordHash: await argon2.hash(PASSWORD, {
          algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1,
        }),
        roles: ["admin"],
        status: "active",
        locale: "en-CA",
        legalName: { first: "Staff" },
        phone: null,
        dateOfBirth: null,
        mfa: { enabled: true, secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" },
        lastLoginAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        tokenVersion: 0,
        closedAt: null,
        closureReason: null,
      });

      const { createHmac } = require("node:crypto");
      const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
      let bits = 0, value = 0; const bytes = [];
      for (const ch of secret) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
      const counter = Math.floor(Date.now() / 30000);
      const buf = Buffer.alloc(8);
      buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
      buf.writeUInt32BE(counter >>> 0, 4);
      const d = createHmac("sha1", Buffer.from(bytes)).update(buf).digest();
      const o = d[d.length - 1] & 0x0f;
      const code = String((((d[o] & 0x7f) << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) % 1e6).padStart(6, "0");

      const st = await (await browser.newContext()).newPage();
      await st.goto(BASE + "/login", { waitUntil: "networkidle" });
      await st.fill('input[name="email"]', staffEmail);
      await st.fill('input[name="password"]', PASSWORD);
      await st.click('button[type="submit"]');
      await st.waitForURL("**/mfa**", { timeout: 30_000 });
      await st.fill('input[name="code"]', code);
      await st.click('button[type="submit"]');
      await st.waitForTimeout(3000);

      await st.goto(`${BASE}/conversations/${cid}`, { waitUntil: "networkidle" });
      const staffView = await visible(st);
      check("staff can read it", /Thank you for accepting/.test(staffView));
      check("and are told it was recorded", /reading this as staff/i.test(staffView));
      check(
        "with no composer — oversight reads, it does not speak",
        (await st.locator('textarea[name="body"]').count()) === 0
      );

      const audited = await db
        .collection("auditLog")
        .findOne({ action: "staff.readConversation", "subject.id": cid });
      check("and the read is in the audit log", !!audited);
      await st.close();
    }

    /* ---------- the wali ends it ------------------------------------- */
    await waliPage.goto(`${BASE}/conversations/${cid}`, { waitUntil: "networkidle" });
    await waliPage.click('button:has-text("End this conversation")');
    await waliPage.waitForSelector('input[name="reason"]', { timeout: 15_000 });
    await waliPage.fill('input[name="reason"]', "They should meet the families now.");
    await waliPage.click('button:has-text("End it")');
    await waliPage.waitForTimeout(3000);

    const closed = await db.collection("conversations").findOne({ _id: conversation._id });
    check("he can end it, and it records that he did", closed.state === "closedByWali");
    check("with his reason", (closed.closeReason ?? "").includes("families"));

    await him.page.goto(`${BASE}/conversations/${cid}`, { waitUntil: "networkidle" });
    const after = await visible(him.page);
    check("it says so, and that nothing was removed", /nothing already said has been removed/i.test(after));
    check(
      "and nobody can write in it",
      (await him.page.locator('textarea[name="body"]').count()) === 0
    );

    const stillThere = await db.collection("messages").countDocuments({ conversationId: cid });
    check("every message survives the closing", stillThere === 2);
  } finally {
    await browser.close();
    /* Only this checker's own. Wiping the collection would hide
       exactly the leftovers that broke this one. */
    const ids = [];
    for (const email of emails) {
      const u = await db.collection("users").findOne({ email });
      if (u) ids.push(String(u._id));
    }
    const convs = await db
      .collection("conversations")
      .find({ "participants.userId": { $in: ids } })
      .toArray();
    for (const c of convs) {
      await db.collection("messages").deleteMany({ conversationId: c._id.toHexString() });
      await db.collection("conversations").deleteOne({ _id: c._id });
    }
    for (const email of emails) {
      const u = await db.collection("users").findOne({ email });
      if (!u) continue;
      const id = String(u._id);
      await db.collection("sessions").deleteMany({ userId: id });
      await db.collection("verificationTokens").deleteMany({ userId: id });
      await db.collection("guardianships").deleteMany({ $or: [{ memberUserId: id }, { waliUserId: id }] });
      await db.collection("connectionLedger").deleteMany({ userId: id });
      await db.collection("connectionRequests").deleteMany({ $or: [{ fromUserId: id }, { toUserId: id }] });
      await db.collection("profiles").deleteMany({ userId: u._id });
      await db.collection("auditLog").deleteMany({ "actor.userId": id });
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
  console.log(`\nall ${checks} conversation checks pass`);
})().catch((err) => {
  console.error("\n" + (err && err.stack));
  process.exit(1);
});
