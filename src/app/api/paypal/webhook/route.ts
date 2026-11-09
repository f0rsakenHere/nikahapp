import { NextResponse } from "next/server";
import { planChangeFor, planIsRight, type SubscriptionEvent } from "@/lib/domain/subscription";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import {
  extendMembership,
  noteOutcome,
  recordEvent,
  userForSubscription,
} from "@/lib/repositories/subscriptions";
import {
  genderForPlan,
  getSubscription,
  paypalIsConfigured,
  webhookIsGenuine,
  type PaypalSubscription,
} from "@/lib/payments/paypal";

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
    /** Present on subscription events, absent on renewal payments. */
    plan_id?: string;
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
    planId: resource.plan_id ?? null,
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
  /* Asked for at most once, and only if something below needs it. A
     renewal payment names neither the member nor the plan, so both
     questions can end up here, and there is no sense paying for two
     round trips to answer them. */
  let fetched: PaypalSubscription | null | undefined;
  async function subscription(): Promise<PaypalSubscription | null> {
    if (fetched !== undefined) return fetched;
    if (!subscriptionId) return (fetched = null);
    try {
      fetched = await getSubscription(subscriptionId);
    } catch (e) {
      log(`could not read subscription ${subscriptionId}`, e);
      fetched = null;
    }
    return fetched;
  }

  let userId = event.userId;
  if (!userId && subscriptionId) {
    userId = await userForSubscription(subscriptionId);
  }
  if (!userId && subscriptionId) {
    userId = (await subscription())?.custom_id ?? null;
  }

  if (!userId) {
    /* 200: retrying will not conjure a member. Recorded so somebody can
       work out whose payment this was by hand. */
    const why = `no member could be matched to subscription ${subscriptionId ?? "(none)"}`;
    log(`${eventType} — ${why}`);
    await noteOutcome(eventId, why);
    return NextResponse.json({ ok: true });
  }

  /* And is this the plan they owe?
   *
   * `plan_id` is chosen by the browser when the subscription is
   * created. Our page only ever offers somebody their own, but nothing
   * stops a page being edited, and the two plans are not the same
   * price — so without this a brother who learns the sisters' plan id
   * subscribes at $9.99 and PayPal takes it, because PayPal is
   * enforcing its own plan and has never heard of our rule about who
   * may buy which.
   *
   * Checked here rather than at the button, because the button is the
   * part we do not control. */
  const planId = resource.plan_id ?? (await subscription())?.plan_id ?? null;
  const profile = await findProfileByUserId(userId);
  const right = planIsRight(genderForPlan(planId), profile?.gender ?? null);
  if (!right.ok) {
    /* 200: PayPal sending it again would not make it right. Recorded in
       words, with the plan, so whoever picks this up can refund it or
       put the member on the correct plan. */
    const why = `${right.because} — not granted (plan ${planId ?? "unknown"}, member ${userId})`;
    log(`${eventType} — REFUSED: ${why}`);
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
