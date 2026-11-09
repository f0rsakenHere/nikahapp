/* Registers the webhook PayPal calls when somebody pays.
 *
 * Without this, subscriptions are approved in the browser and nothing
 * ever reaches us: the member pays and the site never notices. The
 * webhook id it prints is as important as the URL — the signature check
 * needs it to verify anything, and a missing PAYPAL_WEBHOOK_ID makes
 * the endpoint reject every event, which is the correct failure but an
 * opaque one.
 *
 *   node scripts/paypal-webhook.cjs                 # what is registered
 *   node scripts/paypal-webhook.cjs --apply         # register it
 *   node scripts/paypal-webhook.cjs --apply --url https://staging.example/api/paypal/webhook
 *
 * PayPal will not accept an http:// URL or a hostname it cannot
 * resolve, so the endpoint has to be deployed before this will work.
 */
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();

const APPLY = process.argv.includes("--apply");
const DELETE = process.argv.includes("--delete");
const urlArg = (() => {
  const i = process.argv.indexOf("--url");
  return i === -1 ? null : process.argv[i + 1];
})();

const URL_ = urlArg || `${process.env.APP_ORIGIN || "https://nikahcanada.ca"}/api/paypal/webhook`;

const ENV = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
const HOST = ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

/* Only what we act on. Subscribing to everything would fill the
   payments collection with orders, disputes and payouts that nothing
   reads, and make the log useless for the one question it exists to
   answer: why does this member's membership say what it says. */
const EVENTS = [
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.RE-ACTIVATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED",
];

let token = null;
async function api(path, init = {}) {
  if (!token) {
    const id = requireEnv("PAYPAL_CLIENT_ID");
    const secret = requireEnv("PAYPAL_SECRET");
    const res = await fetch(`${HOST}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`\nFAIL  PayPal refused the credentials for ${ENV}: ${res.status} ${b.error ?? ""}`);
      console.error("      Run `npm run check:paypal`.\n");
      process.exit(1);
    }
    token = b.access_token;
  }
  const { json, ...rest } = init;
  const res = await fetch(`${HOST}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
    body: json === undefined ? rest.body : JSON.stringify(json),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`PayPal ${res.status} on ${path}`);
    err.body = body;
    throw err;
  }
  return body;
}

(async () => {
  console.log(`environment: ${ENV}`);
  console.log(`url:         ${URL_}`);
  console.log("");

  const list = await api("/v1/notifications/webhooks");
  const have = list.webhooks ?? [];

  if (have.length) {
    console.log(`${have.length} webhook(s) already registered:`);
    for (const w of have) {
      console.log(`  ${w.id}  ${w.url}`);
      console.log(`      ${(w.event_types ?? []).map((e) => e.name).join(", ") || "(no events)"}`);
    }
  } else {
    console.log("No webhooks registered on this account.");
  }
  console.log("");

  const mine = have.find((w) => w.url === URL_);

  if (DELETE) {
    if (!mine) {
      console.log("Nothing registered at that URL.");
      return;
    }
    if (!APPLY) {
      console.log(`Would delete ${mine.id}. Re-run with --apply.`);
      return;
    }
    await api(`/v1/notifications/webhooks/${mine.id}`, { method: "DELETE" });
    console.log(`deleted ${mine.id}`);
    return;
  }

  if (mine) {
    const names = new Set((mine.event_types ?? []).map((e) => e.name));
    const missing = EVENTS.filter((e) => !names.has(e));
    if (!missing.length) {
      console.log("Already registered with every event we handle. Put this in .env.local:\n");
      console.log(`  PAYPAL_WEBHOOK_ID=${mine.id}\n`);
      return;
    }
    if (!APPLY) {
      console.log(`Registered, but missing: ${missing.join(", ")}`);
      console.log("Re-run with --apply to add them.");
      return;
    }
    await api(`/v1/notifications/webhooks/${mine.id}`, {
      method: "PATCH",
      json: [{ op: "replace", path: "/event_types", value: EVENTS.map((name) => ({ name })) }],
    });
    console.log(`updated ${mine.id}. Put this in .env.local:\n`);
    console.log(`  PAYPAL_WEBHOOK_ID=${mine.id}\n`);
    return;
  }

  if (!APPLY) {
    console.log("Would register:");
    console.log(`  ${URL_}`);
    for (const e of EVENTS) console.log(`    ${e}`);
    console.log("\nNothing written. Re-run with --apply.\n");
    return;
  }

  const made = await api("/v1/notifications/webhooks", {
    method: "POST",
    json: { url: URL_, event_types: EVENTS.map((name) => ({ name })) },
  });
  console.log(`registered ${made.id}\n`);
  console.log("Put this in .env.local on the server, then restart it:\n");
  console.log(`  PAYPAL_WEBHOOK_ID=${made.id}\n`);
})().catch((e) => {
  console.error("\nFAIL ", e.message);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 1000));
  process.exitCode = 1;
});
