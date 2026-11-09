import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { furthest } from "@/lib/domain/subscription";

/* Memberships, as the database sees them.
 *
 * Two jobs. Keep a row for every event PayPal sends, so there is a
 * record of why somebody's membership says what it says — money is the
 * one thing a member will certainly dispute, and "the system decided"
 * is not an answer. And move `planActiveUntil`, which is the single
 * field the paywall reads.
 */

type PaymentDoc = {
  _id: ObjectId;
  /** PayPal's event id. Unique, and the whole idempotency mechanism:
   *  PayPal retries anything it is not sure we received, so the same
   *  activation can arrive three times. */
  eventId: string;
  eventType: string;
  subscriptionId: string | null;
  userId: string | null;
  /** What we did about it, in words, for whoever reads this later. */
  outcome: string;
  receivedAt: Date;
  /** PayPal's own payload, kept whole. Small, and the only account of
   *  what they actually said if a charge is ever questioned. */
  raw: unknown;
};

async function payments() {
  return (await getDb()).collection<PaymentDoc>(COLLECTIONS.payments);
}

/** Records an event, and says whether it is new.
 *
 *  `false` means we have seen this exact event before and the caller
 *  should stop: acting twice on one activation is how somebody gets two
 *  months for one payment, and acting twice on a retry is the normal
 *  case rather than the exceptional one. */
export async function recordEvent(input: {
  eventId: string;
  eventType: string;
  subscriptionId: string | null;
  userId: string | null;
  outcome: string;
  raw: unknown;
}): Promise<boolean> {
  try {
    await (
      await payments()
    ).insertOne({ ...input, receivedAt: new Date() } as PaymentDoc);
    return true;
  } catch (e) {
    /* Duplicate key: the unique index on eventId did its job. Anything
       else is a real failure and must not be swallowed, or a database
       outage would read as "already handled" and the event would be
       dropped silently. */
    if (typeof e === "object" && e && (e as { code?: number }).code === 11000) return false;
    throw e;
  }
}

/** Notes what we did, once the caller knows. */
export async function noteOutcome(eventId: string, outcome: string): Promise<void> {
  await (await payments()).updateOne({ eventId }, { $set: { outcome } });
}

/** Moves a member's paid-through date forward, never back.
 *
 *  Read-then-write rather than `$max`, because the stored value may be
 *  absent on accounts older than plans, and because the subscription id
 *  is written in the same breath. Two webhooks racing is harmless: both
 *  write the later date, and the loser's write is a no-op. */
export async function extendMembership(
  userId: string,
  until: Date,
  subscriptionId: string | null
): Promise<{ from: Date | null; to: Date }> {
  const users = (await getDb()).collection(COLLECTIONS.users);
  let _id: ObjectId;
  try {
    _id = new ObjectId(userId);
  } catch {
    throw new Error(`not a user id: ${userId}`);
  }

  const user = await users.findOne({ _id }, { projection: { planActiveUntil: 1 } });
  if (!user) throw new Error(`no such user: ${userId}`);

  const from = (user.planActiveUntil as Date | null | undefined) ?? null;
  const to = furthest(from, until);

  await users.updateOne(
    { _id },
    {
      $set: {
        planActiveUntil: to,
        ...(subscriptionId ? { paypalSubscriptionId: subscriptionId } : {}),
        updatedAt: new Date(),
      },
    }
  );
  return { from, to };
}

/** Whose subscription this is, when the event did not say.
 *
 *  The event normally carries our own user id in `custom_id`, which is
 *  set when the subscription is created. This is the fallback for the
 *  ones that do not — a renewal payment names the subscription and not
 *  the subscriber. */
export async function userForSubscription(subscriptionId: string): Promise<string | null> {
  const user = await (await getDb())
    .collection(COLLECTIONS.users)
    .findOne({ paypalSubscriptionId: subscriptionId }, { projection: { _id: 1 } });
  return user ? String(user._id) : null;
}

/** Ties a PayPal subscription to the member who started it, as soon as
 *  the browser comes back — before any webhook has necessarily arrived. */
export async function linkSubscription(userId: string, subscriptionId: string): Promise<void> {
  await (await getDb())
    .collection(COLLECTIONS.users)
    .updateOne(
      { _id: new ObjectId(userId) },
      { $set: { paypalSubscriptionId: subscriptionId, updatedAt: new Date() } }
    );
}
