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
export async function listSessionsForUser(userId: string): Promise<SessionRecord[]> {
  const docs = await (await sessions())
    .find({ userId }, { sort: { lastSeenAt: -1 }, projection: { _id: 0 } })
    .toArray();
  return docs as unknown as SessionRecord[];
}

/** Promotes a half-authenticated session once the second factor is in. */
export async function clearPendingMfa(tokenHash: string): Promise<void> {
  await (await sessions()).updateOne({ tokenHash }, { $set: { pendingMfa: false } });
}
