/* Talking to PayPal.
 *
 * Server only, and deliberately small: a token, three calls, and the
 * signature check that decides whether a webhook is really from PayPal.
 * The rule about what any of it *means* lives in
 * `@/lib/domain/subscription`, pure and tested; this file is the part
 * that cannot be tested without a network.
 *
 * Nothing here throws on a missing configuration at import time. The
 * site has to keep working with no PayPal set up at all — that is its
 * state today and will be again the first time a key is rotated — so
 * `paypalIsConfigured()` is the guard every caller asks first, the same
 * way `emailIsConfigured()` works for the mailer.
 */

/* This module holds the account's secret. It must never be bundled into
 * a client component. The same guard `src/lib/db/client.ts` uses, and
 * for the same reason: it is the `server-only` package's job, without
 * the dependency. */
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/payments/paypal.ts was imported into client code. It holds the " +
      "PayPal secret and belongs in a Server Component, a route handler or a server action."
  );
}

export type PaypalEnv = "sandbox" | "live";

const HOSTS: Record<PaypalEnv, string> = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

/** Which PayPal this build talks to.
 *
 *  Explicit, never inferred from NODE_ENV. The two environments have
 *  separate credentials and separate plan ids, and guessing wrong does
 *  not fail loudly — it fails as `401 invalid_client`, which reads as a
 *  bad password rather than a wrong address. */
export function paypalEnv(): PaypalEnv {
  return process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
}

export function paypalIsConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);
}

/** The plan a member of this gender subscribes to. Null when that plan
 *  has not been created yet, which is a configuration state and not an
 *  error: the membership page says so rather than offering a button
 *  that cannot work. */
export function planIdFor(gender: "brother" | "sister" | null): string | null {
  if (gender === "brother") return process.env.PAYPAL_PLAN_BROTHER || null;
  if (gender === "sister") return process.env.PAYPAL_PLAN_SISTER || null;
  return null;
}

export class PaypalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(message);
    this.name = "PaypalError";
  }
}

/* One token serves every request for nine hours, so it is held here
   rather than fetched per call. Refreshed a minute early, because a
   token that expires mid-flight fails as a 401 that looks like a
   credential problem. */
let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!id || !secret) throw new PaypalError("PayPal is not configured", 0, null);

  const res = await fetch(`${HOSTS[paypalEnv()]}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!res.ok || !body.access_token) {
    /* Says which host, because the commonest cause of a 401 here is
       sandbox credentials pointed at live or the other way round, and
       the message PayPal returns is identical either way. */
    throw new PaypalError(
      `PayPal refused the credentials for the ${paypalEnv()} environment`,
      res.status,
      body
    );
  }

  cached = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(0, (body.expires_in ?? 0) - 60) * 1000,
  };
  return cached.token;
}

/** A call to PayPal's REST API, with the token attached. */
export async function paypal<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`${HOSTS[paypalEnv()]}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
    body: json === undefined ? rest.body : JSON.stringify(json),
    cache: "no-store",
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new PaypalError(`PayPal ${res.status} on ${path}`, res.status, body);
  return body as T;
}

export type PaypalSubscription = {
  id: string;
  status: string;
  plan_id?: string;
  /** Our own user id, set when the subscription was created. */
  custom_id?: string;
  billing_info?: { next_billing_time?: string };
  subscriber?: { email_address?: string };
};

export function getSubscription(id: string): Promise<PaypalSubscription> {
  return paypal<PaypalSubscription>(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);
}

/** Whether a webhook really came from PayPal.
 *
 *  This is the only thing standing between the endpoint and anyone who
 *  finds its address: without it, a stranger can POST "subscription
 *  activated" and hand themselves a membership. It asks PayPal to check
 *  the signature rather than verifying the certificate chain here,
 *  which is slower by one request and very much harder to get subtly
 *  wrong.
 *
 *  Returns false — never throws — when the configuration is missing, so
 *  that an unconfigured endpoint rejects everything instead of failing
 *  open. */
export async function webhookIsGenuine(
  headers: Headers,
  rawBody: string
): Promise<{ ok: boolean; why?: string }> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return { ok: false, why: "PAYPAL_WEBHOOK_ID is not set" };
  if (!paypalIsConfigured()) return { ok: false, why: "PayPal is not configured" };

  const need = [
    "paypal-transmission-id",
    "paypal-transmission-time",
    "paypal-transmission-sig",
    "paypal-cert-url",
    "paypal-auth-algo",
  ] as const;
  const got: Record<string, string> = {};
  for (const h of need) {
    const v = headers.get(h);
    if (!v) return { ok: false, why: `missing header ${h}` };
    got[h] = v;
  }

  try {
    const result = await paypal<{ verification_status?: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        /* `webhook_event` must be the body as PayPal sent it, parsed
           but not reshaped — re-serialising a modified object changes
           the bytes the signature was made over. */
        json: {
          transmission_id: got["paypal-transmission-id"],
          transmission_time: got["paypal-transmission-time"],
          cert_url: got["paypal-cert-url"],
          auth_algo: got["paypal-auth-algo"],
          transmission_sig: got["paypal-transmission-sig"],
          webhook_id: webhookId,
          webhook_event: JSON.parse(rawBody),
        },
      }
    );
    return result.verification_status === "SUCCESS"
      ? { ok: true }
      : { ok: false, why: `PayPal said ${result.verification_status ?? "nothing"}` };
  } catch (e) {
    return { ok: false, why: e instanceof Error ? e.message : String(e) };
  }
}
