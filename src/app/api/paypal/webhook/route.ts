import { NextResponse } from "next/server";
import { planChangeFor, type SubscriptionEvent } from "@/lib/domain/subscription";
import {
  extendMembership,
  noteOutcome,
  recordEvent,
  userForSubscription,
} from "@/lib/repositories/subscriptions";
import { getSubscription, paypalIsConfigured, webhookIsGenuine } from "@/lib/payments/paypal";

/* Where PayPal tells us somebody has paid.
 *
 * This endpoint is public — it has to be, PayPal calls it from their
 * own servers — so the signature check is the only thing standing
 * between it and anyone who guesses the address. Without it a stranger
 * POSTs "subscription activated" with their own user id and gives
 * themselves a membership. Every path below that rejects a request
 * returns 200 or 400 *without touching the database*.
 *
 * On 2xx PayPal considers the event delivered. On anything else it
 * retries, for days. So the rule is: answer 200 for anything we have
 * genuinely finished with, including events we deliberately ignore, and
 * reserve a 5xx for "we could not do our job and want to be told
 * again".
 */

/* The raw body is needed byte for byte — the signature is over what was
   sent, and Next must not parse, cache or revalidate any of it. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PaypalWebhook = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    billing_agreement_id?: string;
    billing_info?: { next_billing_time?: string };
  };
};

function log(line: string, extra?: unknown) {
  /* Deliberately console: there is no log sink yet, and journalctl on
     the server is where this will be read from. */
  console.log(`[paypal] ${line}`, extra === undefined ? "" : extra);
}

export async function POST(request: Request) {
  if (!paypalIsConfigured()) {
    log("ignored: PayPal is not configured on this deployment");
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const raw = await request.text();

  const genuine = await webhookIsGenuine(request.headers, raw);
  if (!genuine.ok) {
    /* 400, not 401: this is PayPal's own convention for a webhook it
       should not retry, and a forged one must not be retried at all. */
    log(`REJECTED unverified webhook — ${genuine.why}`);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let body: PaypalWebhook;
  try {
    body = JSON.parse(raw);
  } catch {
    log("REJECTED: body was not JSON, though it was signed");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventId = body.id;
  const eventType = body.event_type;
  if (!eventId || !eventType) {
    log("REJECTED: signed body had no event id or type");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const resource = body.resource ?? {};
  /* A subscription event names itself in `resource.id`; a payment names
     the subscription it belongs to in `billing_agreement_id`. */
  const subscriptionId = resource.id?.startsWith("I-")
    ? resource.id
    : (resource.billing_agreement_id ?? null);

  const event: SubscriptionEvent = {
    type: eventType,
    subscriptionId,
    userId: resource.custom_id ?? null,
    nextBillingTime: resource.billing_info?.next_billing_time
      ? new Date(resource.billing_info.next_billing_time)
      : null,
  };

  /* Written before anything is decided, so that a crash halfway leaves
     a record rather than a silence — and so that the retry PayPal then
     sends is recognised as a repeat. */
  const isNew = await recordEvent({
    eventId,
    eventType,
    subscriptionId,
    userId: event.userId,
    outcome: "received",
    raw: body,
  });

  if (!isNew) {
    log(`${eventType} ${eventId} seen before, ignoring`);
    return NextResponse.json({ ok: true, repeat: true });
  }

  const change = planChangeFor(event, new Date());
  if (change.move === "none") {
    log(`${eventType} — ${change.because}`);
    await noteOutcome(eventId, change.because);
    return NextResponse.json({ ok: true });
  }

  /* Who is this? `custom_id` is the reliable answer and is set when the
     subscription is created. Renewal payments do not carry it, so fall
     back to the subscription we stored, and only then ask PayPal. */
  let userId = event.userId;
  if (!userId && subscriptionId) {
    userId = await userForSubscription(subscriptionId);
  }
  if (!userId && subscriptionId) {
    try {
      const sub = await getSubscription(subscriptionId);
      userId = sub.custom_id ?? null;
    } catch (e) {
      log(`could not read subscription ${subscriptionId}`, e);
    }
  }

  if (!userId) {
    /* 200: retrying will not conjure a member. Recorded so somebody can
       work out whose payment this was by hand. */
    const why = `no member could be matched to subscription ${subscriptionId ?? "(none)"}`;
    log(`${eventType} — ${why}`);
    await noteOutcome(eventId, why);
    return NextResponse.json({ ok: true });
  }

  try {
    const { from, to } = await extendMembership(userId, change.until, subscriptionId);
    const outcome = `membership extended to ${to.toISOString()} (was ${from ? from.toISOString() : "none"})`;
    log(`${eventType} — ${outcome} for ${userId}`);
    await noteOutcome(eventId, outcome);
    return NextResponse.json({ ok: true });
  } catch (e) {
    /* 500 on purpose: the event was genuine and we failed to act on it,
       so we want PayPal to send it again. The row already written keeps
       the attempt visible. */
    log(`FAILED to extend membership for ${userId}`, e);
    await noteOutcome(eventId, `failed: ${e instanceof Error ? e.message : String(e)}`).catch(
      () => {}
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/** PayPal does not GET this, but people and uptime checks do. Says
 *  nothing about configuration to an anonymous caller. */
export function GET() {
  return NextResponse.json({ ok: true, endpoint: "paypal webhook" });
}
