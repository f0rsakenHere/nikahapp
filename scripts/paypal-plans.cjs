/* Creates the PayPal product and the two membership plans.
 *
 * Sisters $9.99 a month, brothers $19.99, both CAD — a plan carries one
 * currency and one price, which is why there are two of them rather
 * than one with options.
 *
 * Creating a product and a plan moves no money and charges nobody. It
 * is still a write to a real PayPal account, so it is a dry run unless
 * you pass --apply, and it refuses to make a second copy of a plan it
 * has already made.
 *
 *   node scripts/paypal-plans.cjs            # show what it would do
 *   node scripts/paypal-plans.cjs --apply    # do it
 *   node scripts/paypal-plans.cjs --list     # what already exists
 *
 * It prints the two plan ids at the end. Those go in .env.local as
 * PAYPAL_PLAN_SISTER and PAYPAL_PLAN_BROTHER.
 */
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();

const APPLY = process.argv.includes("--apply");
const LIST = process.argv.includes("--list");

const ENV = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
const HOST = ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

/* No `category`. It is optional, and PayPal's enum is a long fixed list
   of merchant categories whose values are not guessable — the first
   attempt here was rejected outright. Better absent than wrong: the
   category is PayPal's own filing, not anything a member sees, and a
   mis-declared one is worse than none when an account is underwritten.
   If PayPal ever asks for it, take the value from their list rather
   than inventing one that reads right. */
const PRODUCT = {
  name: "NikahCanada membership",
  description: "Monthly membership for NikahCanada.",
  type: "SERVICE",
};

const PLANS = [
  { key: "PAYPAL_PLAN_SISTER", name: "NikahCanada — sisters", price: "9.99" },
  { key: "PAYPAL_PLAN_BROTHER", name: "NikahCanada — brothers", price: "19.99" },
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
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`\nFAIL  PayPal refused the credentials for ${ENV}.`);
      console.error(`      ${res.status} ${body.error ?? ""} ${body.error_description ?? ""}`);
      console.error("      Run `npm run check:paypal` — the usual cause is the wrong environment.\n");
      process.exit(1);
    }
    token = body.access_token;
  }

  const { json, ...rest } = init;
  const res = await fetch(`${HOST}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      /* PayPal keys creation on this, so a re-run with the same value
         returns the thing already made instead of a duplicate. */
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
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
  console.log(`environment: ${ENV}${ENV === "live" ? "  — this is the real account" : ""}`);
  console.log("");

  /* ---------- what is already there --------------------------------- */
  const existingPlans = await api("/v1/billing/plans?page_size=20&total_required=true").catch(
    (e) => {
      console.error("Could not list plans:", JSON.stringify(e.body ?? e.message).slice(0, 300));
      process.exit(1);
    }
  );
  const have = existingPlans.plans ?? [];
  if (have.length) {
    console.log(`${have.length} plan(s) already on this account:`);
    for (const p of have) console.log(`  ${p.id}  ${p.status.padEnd(8)} ${p.name}`);
  } else {
    console.log("No plans on this account yet.");
  }
  console.log("");

  if (LIST) return;

  const byName = new Map(have.map((p) => [p.name, p]));
  const wanted = PLANS.filter((p) => !byName.has(p.name));

  if (!wanted.length) {
    console.log("Both membership plans already exist. Put these in .env.local:\n");
    for (const p of PLANS) console.log(`  ${p.key}=${byName.get(p.name).id}`);
    console.log("");
    return;
  }

  if (!APPLY) {
    console.log("Would create:");
    console.log(`  product  ${PRODUCT.name}`);
    for (const p of wanted) console.log(`  plan     ${p.name}  CAD ${p.price} / month`);
    console.log("\nNothing written. Re-run with --apply to create them.");
    console.log("Creating a plan charges nobody; it only describes what a charge would be.\n");
    return;
  }

  /* ---------- the product ------------------------------------------- */
  const products = await api("/v1/catalogs/products?page_size=20");
  let product = (products.products ?? []).find((p) => p.name === PRODUCT.name);
  if (product) {
    console.log(`product   ${product.id}  (already there)`);
  } else {
    product = await api("/v1/catalogs/products", {
      method: "POST",
      json: PRODUCT,
      requestId: "nikahcanada-membership-product",
    });
    console.log(`product   ${product.id}  created`);
  }

  /* ---------- the plans --------------------------------------------- */
  const ids = {};
  for (const p of PLANS) {
    if (byName.has(p.name)) {
      ids[p.key] = byName.get(p.name).id;
      console.log(`plan      ${ids[p.key]}  (already there)  ${p.name}`);
      continue;
    }
    const plan = await api("/v1/billing/plans", {
      method: "POST",
      requestId: `nikahcanada-${p.key.toLowerCase()}`,
      json: {
        product_id: product.id,
        name: p.name,
        description: `${p.name}, billed monthly.`,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: { interval_unit: "MONTH", interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            /* Zero means "until cancelled", which is what a membership
               is. A fixed count would quietly stop billing one day. */
            total_cycles: 0,
            pricing_scheme: { fixed_price: { value: p.price, currency_code: "CAD" } },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: { value: "0", currency_code: "CAD" },
          setup_fee_failure_action: "CONTINUE",
          /* PayPal retries a failed payment this many times before
             suspending the subscription. Three is its own default and
             spreads over about a week. */
          payment_failure_threshold: 3,
        },
      },
    });
    ids[p.key] = plan.id;
    console.log(`plan      ${plan.id}  created          ${p.name}  CAD ${p.price}/month`);
  }

  console.log("\nPut these in .env.local:\n");
  for (const p of PLANS) console.log(`  ${p.key}=${ids[p.key]}`);
  console.log("");
})().catch((e) => {
  console.error("\nFAIL ", e.message);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 1200));
  process.exitCode = 1;
});
