/* The path a member actually walks: browse → ask → accept → talk.
 *
 * The pieces each have their own checker. This is the join between them,
 * driven through the interface with nothing written directly to the
 * database, because every bug found in this flow so far has been in a
 * seam rather than in a part: a link that was never rendered, a gate
 * that checked the wrong person, a thread that opened with nobody
 * guarding it.
 *
 * Runs against the seeded pool (`scripts/seed-pool.cjs`) and cleans up
 * only what it creates — the request, the conversation and the messages.
 * The seeded people are left where they are.
 *
 *   node scripts/seed-pool.cjs --apply
 *   BASE=http://127.0.0.1:3001 node scripts/pool-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

loadEnv();
const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const PASSWORD = "one good passphrase";
const BROTHER = "yusuf.rahman@seed.test";
const SISTER = "aisha.rahman@seed.test";
/* Her wali is looked up from whoever the request actually reached.
   Hardcoding one made this checker depend on which card browse happened
   to list first — and browse sorts by when a profile went live, so any
   change to the seeded pool silently pointed it at the wrong family. */

let bad = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) bad++;
}

async function signIn(browser, email) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.setDefaultTimeout(30_000);
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90_000 });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', PASSWORD);
  await p.click('button[type="submit"]');
  /* Waited on properly rather than slept through: the landing route may
     still be compiling on a dev server, and navigating again while the
     sign-in redirect is in flight aborts it. */
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }).catch(() => {});
  await p.waitForLoadState("networkidle").catch(() => {});
  return p;
}

const text = (p) => p.innerText("body");

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");
  const seeded = await db.collection("users").countDocuments({ email: /@seed\.test$/ });
  if (!seeded) {
    console.error("\nFAIL  no seeded pool. Run: node scripts/seed-pool.cjs --apply\n");
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch();
  const ids = {};

  try {
    /* ---------- he browses ------------------------------------------ */
    const him = await signIn(browser, BROTHER);
    await assertOurApp(him);
    check("signing in lands on the dashboard", new URL(him.url()).pathname === "/dashboard", him.url());

    await him.goto(`${BASE}/browse`, { waitUntil: "networkidle" });
    const cards = him.locator('a[href^="/browse/"]');
    const count = await cards.count();
    check("the pool has people in it", count > 0, `${count} cards`);

    /* Only sisters, and only sisters with a confirmed wali. */
    const bodyText = await text(him);
    check("a brother is shown sisters", /Sister/.test(bodyText), bodyText.slice(0, 120));

    /* ---------- he asks --------------------------------------------- */
    /* The first card is not necessarily one he *can* ask: anybody he
       already has a request with, in either direction, shows as asked.
       Once the pool has movement in it that is the common case, not the
       edge one, so this walks until it finds somebody askable rather
       than failing on whoever happens to sort first. */
    const hrefs = await him
      .locator('a[href^="/browse/"]')
      .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href")))]);
    /* Only ever a seeded profile.
     *
     * This used to take the first askable card on the page, and the pool
     * is a live database: under deferred approval a real applicant sits
     * in it the moment she sends her profile in. The checker asked one,
     * then tried to sign in as her with the fixture password and reported
     * a broken product. It was not broken — the request was real, and it
     * went to somebody who had not asked to receive it.
     *
     * So the candidates are filtered against `@seed.test` before anything
     * is clicked, and a run with no seeded target stops rather than
     * reaching for whoever is next. */
    const seeded = new Set(
      (
        await db
          .collection("users")
          .find({ email: /@seed\.test$/ }, { projection: { _id: 1 } })
          .toArray()
      ).map((u) => String(u._id))
    );

    let href = null;
    let ask = null;
    for (const candidate of hrefs) {
      const profileId = candidate.split("/").pop();
      if (!ObjectId.isValid(profileId)) continue;
      const profile = await db
        .collection("profiles")
        .findOne({ _id: new ObjectId(profileId) }, { projection: { userId: 1 } });
      if (!profile || !seeded.has(String(profile.userId))) continue;

      await him.goto(BASE + candidate, { waitUntil: "networkidle" });
      const button = him.locator('button:has-text("Ask to talk")').first();
      if ((await button.count()) === 1) {
        href = candidate;
        ask = button;
        break;
      }
    }
    check("a profile opens", /Sister|Brother/.test(await text(him)), him.url());
    check("there is somebody in the pool he can still ask", ask !== null, `${hrefs.length} tried`);
    if (!ask) {
      throw new Error(
        "no seeded sister left to ask — clear the seeded requests, or re-seed. " +
          "This checker will not ask a real member."
      );
    }
    check("there is something to press", (await ask.count()) === 1);
    await ask.click();
    await him.waitForTimeout(4000);
    check(
      "the request is acknowledged in words, not silence",
      /Your request is with them/i.test(await text(him)),
      (await text(him)).replace(/\s+/g, " ").slice(0, 220)
    );

    const brotherUser = await db.collection("users").findOne({ email: BROTHER });
    const request = await db
      .collection("connectionRequests")
      .findOne({ fromUserId: String(brotherUser._id) }, { sort: { sentAt: -1 } });
    check("a request row exists", !!request);
    check("and it is pending", request?.state === "pending", request?.state);
    ids.requestId = request?._id;

    /* Ids are stored as strings on the request, so the user has to be
       looked up by ObjectId rather than by the string itself. */
    const recipient = await db
      .collection("users")
      .findOne({ _id: ObjectId.createFromHexString(String(request.toUserId)) });
    check("the request points at a real member", !!recipient, String(request.toUserId));

    const guardianship = await db
      .collection("guardianships")
      .findOne({ memberUserId: String(recipient._id), status: "confirmed" });
    const waliUser = guardianship
      ? await db
          .collection("users")
          .findOne({ _id: ObjectId.createFromHexString(String(guardianship.waliUserId)) })
      : null;
    check("she has a confirmed wali", !!waliUser, "no guardianship");
    const waliName = guardianship ? guardianship.invited.name : "";

    /* ---------- she answers ----------------------------------------- */
    const her = await signIn(browser, recipient?.email ?? SISTER);
    await her.goto(`${BASE}/requests`, { waitUntil: "networkidle" });
    const hers = await text(her);
    check(
      "she sees it waiting on her",
      /Waiting on you/i.test(hers),
      `${her.url()} — ${hers.replace(/\s+/g, " ").slice(0, 240)}`
    );

    const accept = her.locator('button:has-text("Accept")').first();
    check("with an accept button", (await accept.count()) === 1, hers.replace(/\s+/g, " ").slice(0, 240));
    await accept.click();
    await her.waitForTimeout(3500);

    const answered = await db.collection("connectionRequests").findOne({ _id: ids.requestId });
    check("the request is accepted", answered?.state === "accepted", answered?.state);

    const conversation = await db.collection("conversations").findOne({ requestId: String(ids.requestId) });
    check("a conversation was created", !!conversation);
    ids.conversationId = conversation?._id;
    /* D1g, changed: he no longer approves. Once both have said yes they
       proceed, and he receives a copy — so the thread opens on
       acceptance rather than waiting on a third person to notice an
       email. */
    check(
      "it opens straight away rather than waiting on him",
      conversation?.state === "open",
      conversation?.state
    );
    check(
      "and he is in it from the first message",
      (conversation?.participants ?? []).some((x) => x.role === "wali"),
      JSON.stringify(conversation?.participants)
    );

    /* What did not change, and must not: his presence is visible. A wali
       reading a conversation the couple believe is private would be a
       worse arrangement than the one this replaced, not a lighter one. */
    await her.goto(`${BASE}/conversations/${ids.conversationId}`, { waitUntil: "networkidle" });
    const inThread = await text(her);
    check(
      "she is told he is reading it, by name and role",
      inThread.includes(waliName) && /the wali/i.test(inThread),
      inThread.replace(/\s+/g, " ").slice(0, 220)
    );
    check("and nothing says it is waiting on him", !/opens when he approves/i.test(inThread));
    check("she can write immediately", (await her.locator("textarea").count()) === 1);

    /* ---------- her wali reads it ----------------------------------- */
    const wali = await signIn(browser, waliUser.email);
    /* He has no profile, so /dashboard bounces him on — the landing is
       two hops and the URL has to be allowed to settle. */
    await wali.waitForURL("**/wali", { timeout: 30_000 }).catch(() => {});
    check("a wali lands in his own portal", new URL(wali.url()).pathname === "/wali", wali.url());

    const portal = await text(wali);
    check(
      "his portal offers no approval, because he has none to give",
      !/Approve/i.test(portal),
      portal.replace(/\s+/g, " ").slice(0, 200)
    );
    /* The line describing what he can do lives in the empty state, and
       this wali has conversations — so what is asserted here is the
       thing that is on screen either way: her conversations are listed
       for him to open, and he is told who he acts for. */
    check(
      "and lists the conversations he can read",
      /conversations?/i.test(portal) && /who you act for/i.test(portal),
      portal.replace(/\s+/g, " ").slice(0, 220)
    );

    /* ---------- they talk ------------------------------------------- */
    await her.goto(`${BASE}/conversations/${ids.conversationId}`, { waitUntil: "networkidle" });
    await her.fill("textarea", "Assalamu alaikum. Seeded test message.");
    await her.locator('button[type="submit"]').first().click();
    await her.waitForTimeout(3000);
    check("her message is in the thread", /Seeded test message/.test(await text(her)));

    await him.goto(`${BASE}/conversations/${ids.conversationId}`, { waitUntil: "networkidle" });
    check("and he can read it", /Seeded test message/.test(await text(him)));
    await him.fill("textarea", "Wa alaikum assalam. Seeded reply.");
    await him.locator('button[type="submit"]').first().click();
    await him.waitForTimeout(3000);

    await wali.goto(`${BASE}/conversations/${ids.conversationId}`, { waitUntil: "networkidle" });
    const waliSees = await text(wali);
    check("the wali reads both sides", /Seeded test message/.test(waliSees) && /Seeded reply/.test(waliSees));

    /* Counted by kind. There is no system line any more: it recorded the
       wali approving and joining, and he no longer approves. If one
       appears, something is still writing an approval nobody gave. */
    const written = await db
      .collection("messages")
      .countDocuments({ conversationId: String(ids.conversationId), kind: "member" });
    const system = await db
      .collection("messages")
      .countDocuments({ conversationId: String(ids.conversationId), kind: "system" });
    check("both of their messages were stored", written === 2, `${written}`);
    check("and no approval record was written, because none happened", system === 0, `${system}`);
  } finally {
    await browser.close();
    /* Only what this run made. The seeded people stay. */
    if (ids.conversationId) {
      await db.collection("messages").deleteMany({ conversationId: String(ids.conversationId) });
      await db.collection("conversations").deleteOne({ _id: ids.conversationId });
    }
    if (ids.requestId) {
      await db.collection("connectionRequests").deleteOne({ _id: ids.requestId });
      await db.collection("connectionLedger").deleteMany({ requestId: String(ids.requestId) });
    }
    console.log("\ncleaned up the request and the thread; the seeded pool is untouched");
    await client.close();
  }

  console.log(bad ? `\n${bad} check(s) FAILED\n` : "\nbrowse → ask → accept → talk all works\n");
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
