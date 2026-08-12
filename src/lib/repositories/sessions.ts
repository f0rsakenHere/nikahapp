/* The only module that reads or writes `sessions`. */
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import type { SessionRecord } from "@/lib/auth/session";

type SessionDoc = SessionRecord & { _id: ObjectId };

async function sessions() {
  return (await getDb()).collection<SessionDoc>(COLLECTIONS.sessions);
}

export async function insertSession(record: SessionRecord): Promise<void> {
  await (await sessions()).insertOne({ _id: new ObjectId(), ...record });
}

/** Looked up by digest — the plaintext token from the cookie is hashed
 *  first and never queried directly. */
export async function findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
  return (await sessions()).findOne({ tokenHash });
}

export async function touchSession(tokenHash: string, expiresAt: Date, now: Date): Promise<void> {
  await (await sessions()).updateOne({ tokenHash }, { $set: { expiresAt, lastSeenAt: now } });
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await (await sessions()).deleteOne({ tokenHash });
}

/** Every device. The counterpart to `bumpTokenVersion`, for the case
 *  where the records should actually be gone rather than merely
 *  unusable — a closed account, or a member exercising erasure. */
export async function deleteSessionsForUser(userId: string): Promise<number> {
  const result = await (await sessions()).deleteMany({ userId });
  return result.deletedCount ?? 0;
}

/** For the "signed-in devices" list §7.1 asks for.
 *
 *  The digest is included, because each row needs something to revoke by
 *  and nothing else on the record is unique. It is safe to put on the
 *  page: authentication requires the plaintext token, which is only ever
 *  in the cookie, and SHA-256 of 256 random bits does not go backwards.
 *  Revocation still checks ownership — see `revokeSession`. */
/*  Neither filtered nor capped, once. Every sign-in writes a row, the TTL
 *  index runs on `absoluteExpiresAt` (ninety days) rather than on the
 *  fortnight of idle expiry, and nothing pruned in between — so the list
 *  was every sign-in of the last three months, including the ones that
 *  can no longer authenticate anything. On a phone, against an account a
 *  fortnight old, it made the account screen forty-two thousand pixels
 *  tall. Live sessions only, most recent first, cut to `limit`, and the
 *  true count returned so the page can say what it is not showing.
 *
 *  `pin` is the reader's own session, kept at the top wherever it sorts:
 *  `lastSeenAt` only moves when the idle deadline slides, so the device
 *  you are holding is not reliably the most recent row, and a list of
 *  devices that does not say which one is *this* one is a list nobody can
 *  act on. */
export async function listSessionsForUser(
  userId: string,
  { now = new Date(), limit = 8, pin }: { now?: Date; limit?: number; pin?: string } = {}
): Promise<{ sessions: SessionRecord[]; total: number }> {
  const col = await sessions();
  const live = { userId, expiresAt: { $gt: now } };

  const [current, rest, total] = await Promise.all([
    pin ? col.findOne({ ...live, tokenHash: pin }, { projection: { _id: 0 } }) : null,
    col
      .find(pin ? { ...live, tokenHash: { $ne: pin } } : live, {
        sort: { lastSeenAt: -1 },
        projection: { _id: 0 },
        limit: Math.max(1, pin ? limit - 1 : limit),
      })
      .toArray(),
    col.countDocuments(live),
  ]);

  return {
    sessions: [...(current ? [current] : []), ...rest] as unknown as SessionRecord[],
    total,
  };
}

/** Promotes a half-authenticated session once the second factor is in. */
export async function clearPendingMfa(tokenHash: string): Promise<void> {
  await (await sessions()).updateOne({ tokenHash }, { $set: { pendingMfa: false } });
}
