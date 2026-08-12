/* End-to-end check of registration, session and sign-in.
 *
 * Drives a real browser against a running dev server and a real
 * database, because that is the only way to test the parts unit tests
 * cannot reach: the cookie attributes, the server actions, the unique
 * index, and whether a signed-out visitor can actually read a protected
 * page. Creates one account per run and deletes it afterwards.
 *
 * Exits non-zero on any failure, and if it somehow ran no checks.
 *
 *   BASE=http://127.0.0.1:3007 node scripts/auth-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";

/* Stamped so a failed run leaves an obviously disposable record rather
   than something that looks like a member. */
const STAMP = Date.now();
const EMAIL = `authflow+${STAMP}@example.invalid`;
const PASSWORD = "a-long-enough-passphrase";

const findings = [];
let checks = 0;

function check(name, ok, detail = "") {
  checks++;
  if (!ok) findings.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "pass " : "FAIL "} ${name}${detail && !ok ? `  (${detail})` : ""}`);
  return ok;
}

async function fillSignup(page, over = {}) {
  const v = {
    gender: "sister",
    firstName: "Testonly",
    lastName: "Fixture",
    dateOfBirth: "1995-04-12",
    email: EMAIL,
    password: PASSWORD,
    ...over,
  };
  await page.goto(BASE + "/register", { waitUntil: "networkidle" });
  /* Click the label, not the input. The radio is `sr-only` so that the
     segmented pill can be styled, which is exactly how a sighted user
     operates it — the label is the target. Forcing a click on the hidden
     input would test something no user does. */
  await page.click(`label:has(input[name="gender"][value="${v.gender}"])`);
  if (!(await page.isChecked(`input[name="gender"][value="${v.gender}"]`))) {
    throw new Error(`clicking the "${v.gender}" label did not select it`);
  }
  await page.fill('input[name="firstName"]', v.firstName);
  await page.fill('input[name="lastName"]', v.lastName);
  await fillDob(page, v.dateOfBirth);
  await page.fill('input[name="email"]', v.email);
  await page.fill('input[name="password"]', v.password);
  if (v.marriageIntention !== false) await page.check('input[name="marriageIntention"]');
  if (v.terms !== false) await page.check('input[name="terms"]');
  return v;
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
    /* ---------- signed out ------------------------------------------ */
    {
      const p = await browser.newPage();
      await p.goto(BASE + "/register", { waitUntil: "networkidle" });
      await assertOurApp(p);

      await p.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
      const bounced = new URL(p.url());
      check("signed out: /onboarding redirects to /login", bounced.pathname === "/login", p.url());
      check(
        "the destination is carried in ?next",
        bounced.searchParams.get("next") === "/onboarding",
        p.url()
      );

      /* Default deny: a route nobody has added to a list must still be
         protected the moment it exists. */
      await p.goto(BASE + "/conversations", { waitUntil: "networkidle" });
      check(
        "an unbuilt member route is protected too, not 404-public",
        new URL(p.url()).pathname === "/login",
        p.url()
      );

      /* Public routes must stay reachable. */
      for (const route of ["/", "/how-it-works", "/register", "/login", "/legal/privacy"]) {
        await p.goto(BASE + route, { waitUntil: "networkidle" });
        check(`public: ${route} is still reachable`, new URL(p.url()).pathname === route, p.url());
      }
      await p.close();
    }

    /* ---------- the form rejects, and says why ---------------------- */
    {
      const p = await browser.newPage();
      await fillSignup(p, { dateOfBirth: "2015-01-01", terms: false });
      await p.click('button[type="submit"]');
      await p.waitForTimeout(1200);
      const body = await p.textContent("body");
      check("under 18 is refused", /18 or older/.test(body));
      check("unaccepted terms is refused", /accept the privacy policy/i.test(body));
      check("no account was created", (await db.collection("users").countDocuments({ email: EMAIL })) === 0);
      check("the email is not retyped", (await p.inputValue('input[name="email"]')) === EMAIL);
      check("the password is NOT echoed back", (await p.inputValue('input[name="password"]')) === "");
      await p.close();
    }

    /* ---------- register -------------------------------------------- */
    {
      const p = await browser.newPage();
      await fillSignup(p);
      await p.click('button[type="submit"]');
      await p.waitForURL("**/onboarding", { timeout: 15_000 }).catch(() => {});
      check("register lands on /onboarding", new URL(p.url()).pathname === "/onboarding", p.url());
      /* Registration drops them straight into the work, so the landing
         is the profile builder rather than the dashboard. The greeting
         by name lives on the dashboard now — this page is a tab in the
         app, titled for what it is. Both are checked. */
      check(
        "and it is the profile builder, with the steps on it",
        /Your profile/.test(await p.textContent("body")) &&
          /About you/.test(await p.textContent("body"))
      );
      await p.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
      check("the dashboard greets the new member by name", /Testonly/.test(await p.textContent("body")));

      const user = await db.collection("users").findOne({ email: EMAIL });
      check("a user document exists", !!user);
      check("the password is not stored in the clear", user && !JSON.stringify(user).includes(PASSWORD));
      check("the hash is argon2id", !!user && /^\$argon2id\$/.test(user.passwordHash || ""));
      check("roles start at member only", !!user && JSON.stringify(user.roles) === '["member"]');
      check("email is stored lowercased", !!user && user.email === user.email.toLowerCase());

      const profile = user && (await db.collection("profiles").findOne({ userId: user._id }));
      check("a profile draft was created in the same transaction", !!profile);
      check("gender is on the profile", !!profile && profile.gender === "sister");
      check("the profile starts as a draft", !!profile && profile.status === "draft");
      check("initials were derived", !!profile && profile.initials === "T.F");

      const cookie = (await p.context().cookies()).find((c) => c.name === "nc_session");
      check("a session cookie was set", !!cookie);
      check("the session cookie is httpOnly", !!cookie && cookie.httpOnly);
      check("the session cookie is sameSite=Lax", !!cookie && cookie.sameSite === "Lax");

      const stored = cookie && (await db.collection("sessions").findOne({ userId: String(user._id) }));
      check("the session row exists", !!stored);
      check(
        "the raw token is NOT stored — only its digest",
        !!stored && !JSON.stringify(stored).includes(cookie.value)
      );
      await p.close();
    }

    /* ---------- the unique index actually holds --------------------- */
    {
      const p = await browser.newPage();
      await fillSignup(p);
      await p.click('button[type="submit"]');
      await p.waitForTimeout(1500);
      check(
        "a duplicate email is refused",
        /already exists/i.test(await p.textContent("body")),
        p.url()
      );
      check(
        "still exactly one account for that address",
        (await db.collection("users").countDocuments({ email: EMAIL })) === 1
      );
      await p.close();
    }

    /* ---------- sign in --------------------------------------------- */
    {
      const p = await browser.newPage();
      await p.goto(BASE + "/login", { waitUntil: "networkidle" });
      await p.fill('input[name="email"]', EMAIL);
      await p.fill('input[name="password"]', "definitely-the-wrong-one");
      await p.click('button[type="submit"]');
      await p.waitForTimeout(1200);
      /* Read the alert, not the whole page. The body also contains the
         footer's "No account yet? Register", which a body-wide scan
         reports as a disclosure — a false positive that cost a run. */
      const alert = (await p.textContent('[role="alert"]')) || "";
      check("a wrong password is refused", /do not match an account/i.test(alert), alert);
      check(
        "the message does not reveal that the account exists",
        !/no account|not found|wrong password|incorrect password|unknown/i.test(alert),
        alert
      );

      const after = await db.collection("users").findOne({ email: EMAIL });
      check("the failure was counted", !!after && after.failedLoginCount === 1);

      /* An address with no account must be refused identically. */
      await p.fill('input[name="email"]', `nobody+${STAMP}@example.invalid`);
      await p.fill('input[name="password"]', PASSWORD);
      await p.click('button[type="submit"]');
      await p.waitForTimeout(1200);
      check(
        "an unknown address gets the byte-identical message",
        ((await p.textContent('[role="alert"]')) || "").trim() === alert.trim()
      );

      /* An off-site ?next must not be honoured — a sign-in page that
         forwards wherever it is told is a phishing primitive. */
      await p.goto(BASE + "/login?next=https://example.com/phish", { waitUntil: "networkidle" });
      await p.fill('input[name="email"]', EMAIL);
      await p.fill('input[name="password"]', PASSWORD);
      await p.click('button[type="submit"]');
      await p.waitForTimeout(2000);
      check(
        "an off-site ?next is refused, not followed",
        new URL(p.url()).origin === new URL(BASE).origin,
        p.url()
      );

      /* That last attempt refused the off-site `next` but *succeeded*,
         so this browser is now signed in — and /login sends a signed-in
         session home rather than showing the form again. Out first. */
      await p.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
      await p.click('button:has-text("Sign out")');
      await p.waitForTimeout(1200);
      check(
        "a signed-in visitor to /login is sent home, not shown the form",
        await (async () => {
          const q = await browser.newPage();
          await q.goto(BASE + "/login", { waitUntil: "networkidle" });
          await q.fill('input[name="email"]', EMAIL);
          await q.fill('input[name="password"]', PASSWORD);
          await q.click('button[type="submit"]');
          await q.waitForURL("**/dashboard", { timeout: 20_000 }).catch(() => {});
          await q.goto(BASE + "/login", { waitUntil: "networkidle" });
          const where = new URL(q.url()).pathname;
          await q.close();
          return where === "/dashboard";
        })()
      );

      /* Uppercase, to prove the lookup lowercases. */
      await p.goto(BASE + "/login", { waitUntil: "networkidle" });
      await p.fill('input[name="email"]', EMAIL.toUpperCase());
      await p.fill('input[name="password"]', PASSWORD);
      await p.click('button[type="submit"]');
      await p.waitForURL("**/dashboard", { timeout: 15_000 }).catch(() => {});
      /* The dashboard, not the profile builder: signing in answers "what
         is happening with my account", and for most members the builder
         is a form they finished months ago. */
      check("sign in succeeds, case-insensitively", new URL(p.url()).pathname === "/dashboard", p.url());

      const reset = await db.collection("users").findOne({ email: EMAIL });
      check("the failure counter was cleared", !!reset && reset.failedLoginCount === 0);
      check("the sign-in was recorded", !!reset && !!reset.lastLoginAt);

      /* ---------- sign out ------------------------------------------ */
      /* The button lives on the profile screen and in the account
         settings, not in the app's tab chrome. */
      await p.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
      await p.click('button:has-text("Sign out")');
      await p.waitForTimeout(1200);
      check("sign out lands on the marketing site", new URL(p.url()).pathname === "/", p.url());

      await p.goto(BASE + "/onboarding", { waitUntil: "networkidle" });
      check("the session is gone afterwards", new URL(p.url()).pathname === "/login", p.url());
      await p.close();
    }
  } finally {
    await browser.close();
    const user = await db.collection("users").findOne({ email: EMAIL });
    if (user) {
      await db.collection("sessions").deleteMany({ userId: String(user._id) });
      await db.collection("profiles").deleteMany({ userId: user._id });
      await db.collection("users").deleteOne({ _id: user._id });
      console.log("\ncleaned up the fixture account");
    }
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
  console.log(`\nall ${checks} auth checks pass`);
})().catch((err) => {
  console.error("\n" + (err && err.stack));
  process.exit(1);
});
