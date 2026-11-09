/* What a message from PayPal means for somebody's membership.
 *
 * Pure, so that the rule can be read and tested without a network, a
 * clock or a database. The webhook route does the talking to PayPal and
 * the writing to Mongo; this decides the one thing that matters —
 * whether the person's `planActiveUntil` moves, and to when.
 *
 * The shape of the rule is deliberately lopsided:
 *
 *   paying EXTENDS access, and nothing SHORTENS it.
 *
 * Only two events move the date, and both move it forward: the
 * subscription activating, and a payment landing. Cancelling, lapsing,
 * being suspended for failed payments — none of them clip the date. A
 * member who cancels on the 2nd has paid up to the 30th and keeps the
 * site until the 30th, at which point the date passes and the plan ends
 * by itself, because `hasActivePlan` is a comparison and not a flag.
 *
 * That asymmetry is a safety property, not a generosity. A webhook that
 * arrives late, twice, out of order, or spoofed can at worst leave
 * somebody paid up slightly too long. The opposite design — events that
 * revoke — can lock a paying member out of a conversation with their
 * prospective spouse because a notification was delayed, and there is no
 * version of this product where that is the better failure.
 */

/** The events we act on, named as PayPal names them. */
export type PaypalEventType =
  | "BILLING.SUBSCRIPTION.ACTIVATED"
  | "BILLING.SUBSCRIPTION.RE-ACTIVATED"
  | "PAYMENT.SALE.COMPLETED"
  | "BILLING.SUBSCRIPTION.CANCELLED"
  | "BILLING.SUBSCRIPTION.SUSPENDED"
  | "BILLING.SUBSCRIPTION.EXPIRED"
  | "BILLING.SUBSCRIPTION.PAYMENT.FAILED";

export type SubscriptionEvent = {
  type: string;
  /** PayPal's subscription id, `I-XXXXXXXX`. */
  subscriptionId: string | null;
  /** Our own user id, passed to PayPal as `custom_id` when the
   *  subscription was created and handed back on every event about it.
   *  The reliable way to know whose membership this is: it does not
   *  depend on our having already stored the subscription id, which
   *  matters because the webhook can beat the browser back to us. */
  userId: string | null;
  /** When PayPal intends to bill again, if it said. */
  nextBillingTime: Date | null;
};

export type PlanChange =
  /** Move `planActiveUntil` to this moment, if it is further out than
   *  what the account already has. */
  | { move: "forward"; until: Date }
  /** Worth recording, but the date does not move. */
  | { move: "none"; because: string };

/* A few days past the next payment, so that a renewal which is a little
 * late — a retried card, a weekend, PayPal's own retry schedule — does
 * not read as a lapse to somebody mid-conversation. The cost of being
 * wrong in this direction is a few free days; in the other it is a
 * locked door. */
export const GRACE_DAYS = 3;

const DAY = 86_400_000;
/* Used only when PayPal activates a subscription without telling us when
 * it will bill next, which it may do on the final cycle of a fixed-term
 * plan. A month plus the grace keeps the member whole until the next
 * event arrives to correct it. */
const FALLBACK_DAYS = 31;

/** What this event does to the member's paid-through date. */
export function planChangeFor(event: SubscriptionEvent, now: Date): PlanChange {
  switch (event.type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
    case "PAYMENT.SALE.COMPLETED": {
      const base = event.nextBillingTime ?? new Date(now.getTime() + FALLBACK_DAYS * DAY);
      return { move: "forward", until: new Date(base.getTime() + GRACE_DAYS * DAY) };
    }

    /* They have told PayPal to stop billing them. They have not asked
       for the month they already bought back, and taking it would be
       the kind of small meanness nobody forgets. */
    case "BILLING.SUBSCRIPTION.CANCELLED":
      return { move: "none", because: "cancelled; the paid period still stands" };

    /* Billing is paused, usually after a card has failed. The date they
       are paid through is unaffected and will pass on its own. */
    case "BILLING.SUBSCRIPTION.SUSPENDED":
      return { move: "none", because: "suspended; the paid period still stands" };

    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      return { move: "none", because: "a payment failed; PayPal will retry" };

    /* The subscription is over. Nothing to do: whatever they were paid
       through has passed or is about to. */
    case "BILLING.SUBSCRIPTION.EXPIRED":
      return { move: "none", because: "expired" };

    default:
      return { move: "none", because: `unhandled event ${event.type}` };
  }
}

export type Gender = "brother" | "sister";

/** Whether the plan somebody actually paid on is the plan they owe.
 *
 *  The two plans are not the same price — sisters $9.99, brothers
 *  $19.99 — and the plan id is chosen in the browser, which is to say
 *  by whoever is sitting at it. Our page only ever offers you your own,
 *  but `plan_id` is sent from the page to PayPal, so a brother who
 *  learns the sisters' plan id can subscribe at half price and PayPal
 *  will happily take it: PayPal is enforcing its own plan, not our rule
 *  about who may buy it. The only place that rule can be enforced is
 *  here, when PayPal tells us what was bought.
 *
 *  It is checked rather than corrected. We cannot quietly charge the
 *  difference, and granting a membership at the wrong price — in either
 *  direction — is a thing a member would find out about later and be
 *  right to be angry about. So it is refused, recorded in words, and
 *  left for a person.
 *
 *  Unknown plan is not the same as wrong plan. A renewal payment names
 *  no plan at all, and the configuration may name plans this build does
 *  not know; neither is evidence of anything, so neither blocks a
 *  payment that is otherwise good.
 */
export function planIsRight(
  planGender: Gender | null,
  memberGender: Gender | null
): { ok: true } | { ok: false; because: string } {
  if (memberGender === null) {
    /* No profile, so no price. Reaching the membership page at all
       requires one, so this is either a wali — who buys nothing — or
       something irregular. Either way it is not a grant. */
    return { ok: false, because: "no profile, so there is no plan this member should be on" };
  }
  if (planGender === null) return { ok: true };
  if (planGender === memberGender) return { ok: true };
  return {
    ok: false,
    because: `paid on the ${planGender}s' plan, but this member is a ${memberGender}`,
  };
}

/** The date to store, given what the account already has.
 *
 *  Never earlier than what is there. Two events about the same payment —
 *  PayPal retries a webhook it thinks we missed, and an activation and
 *  its first payment often arrive together — must not between them hand
 *  somebody a shorter membership than either would alone. */
export function furthest(current: Date | null | undefined, candidate: Date): Date {
  return current && current > candidate ? current : candidate;
}

/** Whether this event is one we would act on at all. Lets the route log
 *  the rest without pretending to have handled them. */
export function isKnownEvent(type: string): boolean {
  const change = planChangeFor(
    { type, subscriptionId: null, userId: null, nextBillingTime: null },
    new Date()
  );
  return change.move === "forward" || !change.because.startsWith("unhandled");
}
