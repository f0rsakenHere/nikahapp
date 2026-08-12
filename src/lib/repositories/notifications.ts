import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";

/* What happened, told to the person it happened to.
 *
 * Everything in this product happens somewhere else: a wali confirms in
 * his own portal, a request is answered on somebody else's screen, a
 * conversation opens because a third person approved it. Until now none
 * of that reached the member — they found out by reloading a page and
 * noticing a number had changed.
 *
 * Separate from the audit log on purpose. That is an append-only record
 * for staff and for the law, written about everything; this is a short
 * list of things one member should be told, in their words, and it can
 * be marked read and eventually pruned. Conflating them would mean
 * either showing members an audit trail or letting a UI concern edit
 * evidence.
 *
 * Nothing here carries a name, a message body or anything a counterpart
 * has not already been shown — a notification is a pointer to a screen
 * that does its own authorisation, not a second copy of the data.
 */

export const NOTIFICATION_KINDS = [
  "request.received",
  "request.accepted",
  "request.declined",
  "request.withdrawn",
  "wali.confirmed",
  "conversation.opened",
  "conversation.message",
  "conversation.closed",
  "profile.live",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type Notification = {
  id: string;
  kind: NotificationKind;
  /** One sentence, already written for this reader. */
  body: string;
  /** Where it happened. Authorisation is the destination's job. */
  href: string;
  readAt: Date | null;
  createdAt: Date;
};

type Doc = Omit<Notification, "id"> & { _id: ObjectId; userId: string };

async function notifications() {
  return (await getDb()).collection<Doc>(COLLECTIONS.notifications);
}

/** Tells somebody something.
 *
 *  Never throws into the caller's path: a request that succeeded and a
 *  notification that did not is a worse outcome than a silent one, and
 *  every one of these is written after the act it describes. */
export async function notify(
  userId: string,
  input: { kind: NotificationKind; body: string; href: string },
  now: Date = new Date()
): Promise<void> {
  try {
    await (await notifications()).insertOne({
      _id: new ObjectId(),
      userId,
      ...input,
      readAt: null,
      createdAt: now,
    });
  } catch {
    /* Deliberately swallowed. See above. */
  }
}

/** Several people, one event — a conversation opening tells three. */
export async function notifyAll(
  userIds: readonly string[],
  input: { kind: NotificationKind; body: string; href: string },
  now: Date = new Date()
): Promise<void> {
  await Promise.all([...new Set(userIds)].map((u) => notify(u, input, now)));
}

export async function listNotifications(userId: string, limit = 40): Promise<Notification[]> {
  const docs = await (await notifications())
    .find({ userId }, { sort: { createdAt: -1 }, limit })
    .toArray();
  return docs.map(({ _id, userId: _u, ...rest }) => ({ id: _id.toHexString(), ...rest }));
}

export async function countUnread(userId: string): Promise<number> {
  return (await notifications()).countDocuments({ userId, readAt: null });
}

/** Marks the lot read. Called when the list is opened — a per-item
 *  "mark as read" is a chore, and this list is a feed rather than an
 *  inbox to be managed. */
export async function markAllRead(userId: string, now: Date = new Date()): Promise<void> {
  await (await notifications()).updateMany({ userId, readAt: null }, { $set: { readAt: now } });
}

export async function forgetNotificationsOf(userId: string): Promise<void> {
  await (await notifications()).deleteMany({ userId });
}
