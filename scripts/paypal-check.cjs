/* Do the PayPal credentials work, and which environment are they for?
 *
 * The first thing to run when somebody hands over a Client ID and a
 * Secret, because a wrong pair fails identically to a right pair
 * pointed at the wrong host: PayPal answers `401 invalid_client` to
 * both, and sandbox credentials sent to the live host look exactly like
 * made-up ones. So this asks both hosts and says which, if either,
 * accepts them.
 *
 * It prints lengths and first characters, never the credentials
 * themselves and never the token it receives: the whole point of
 * keeping these out of chat is defeated by a checker that echoes them
 * into a terminal somebody screenshots.
 *
 *   node scripts/paypal-check.cjs
 */
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();

const id = requireEnv("PAYPAL_CLIENT_ID");
const secret = requireEnv("PAYPAL_SECRET");

const HOSTS = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

/** A REST Client ID from the PayPal dashboard begins with "A". Worth
 *  saying out loud, because the usual reason this script fails is that
 *  the value in the Client ID slot is not a Client ID — an access
 *  token, a plan id, or the secret pasted twice. */
function shapeNote() {
  const notes = [];
  if (!id.startsWith("A")) {
    notes.push(
      `  note  the client id starts "${id.slice(0, 3)}…". PayPal's REST client ids begin with "A",\n` +
        "        so this may not be a client id at all."
    );
  }
  if (!secret.startsWith("E")) {
    notes.push(
      `  note  the secret starts "${secret.slice(0, 3)}…". PayPal's secrets normally begin with "E".`
    );
  }
  return notes;
}

async function tokenFrom(host, a, b) {
  const res = await fetch(`${host}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${a}:${b}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

(async () => {
  console.log(`client id  ${String(id.length).padStart(3)} chars, starts "${id.slice(0, 3)}…"`);
  console.log(`secret     ${String(secret.length).padStart(3)} chars, starts "${secret.slice(0, 3)}…"`);
  console.log("");

  let accepted = null;
  for (const [name, host] of Object.entries(HOSTS)) {
    let line;
    try {
      const { ok, status, body } = await tokenFrom(host, id, secret);
      if (ok) {
        accepted = name;
        /* The scope comes back as a space-separated list of long URLs.
           Trimmed to the part that identifies the permission, because
           what matters here is which features the client ticked on the
           app, and that is unreadable in the raw form. */
        const scopes = String(body.scope ?? "")
          .split(/\s+/)
          .filter(Boolean)
          .map((s) => s.replace(/^https?:\/\/[^/]+\/v1\//, ""))
          .sort();
        /* Matched loosely on purpose. The first version of this looked
           for "billing/subscriptions", which is the REST path and not
           the scope name — PayPal grants
           `https://uri.paypal.com/services/subscriptions` — so it
           reported a correctly configured app as unable to take
           subscriptions. A checker that calls a working setup broken
           costs more than no checker. */
        const subs = scopes.some((s) => /subscriptions/.test(s));
        line =
          `accepted. a token was issued, good for ${Math.round((body.expires_in ?? 0) / 60)} minutes.\n` +
          `                   subscriptions: ${
            subs ? "enabled" : "NOT ENABLED — this app cannot manage subscriptions"
          }\n` +
          `                   ${scopes.length} scopes granted:\n` +
          scopes.map((s) => `                     ${s}`).join("\n");
      } else {
        line = `${status} ${body.error ?? ""} ${body.error_description ?? ""}`.trim();
      }
    } catch (e) {
      line = `unreachable: ${String(e).slice(0, 100)}`;
    }
    console.log(`  ${name.padEnd(8)} ${line}`);
  }

  console.log("");
  if (accepted) {
    console.log(`These are ${accepted.toUpperCase()} credentials. Set PAYPAL_ENV=${accepted} in .env.local.`);
    process.exitCode = 0;
    return;
  }

  console.log("Neither host accepted them, so this is not a working pair.");
  for (const n of shapeNote()) console.log(n);
  console.log("");
  console.log("Most likely causes, in order:");
  console.log("  1. A character was mistyped or lost in transit. Ask for them as text,");
  console.log("     copied with the dashboard's own copy button — never from a screenshot.");
  console.log("  2. The app was deleted, or its secret regenerated, after these were sent.");
  console.log("  3. The value in the client id slot is not a client id.");
  process.exitCode = 1;
})();
