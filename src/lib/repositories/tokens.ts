/* The only module that reads or writes `verificationTokens`. */
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { MAX_ACTIVE_TOKENS, type AuthToken, type TokenPurpose } from "@/lib/auth/tokens";

type TokenDoc = AuthToken & { _id: ObjectId };

async function tokens() {
  return (await getDb()).collection<TokenDoc>(COLLECTIONS.verificationTokens);
}

export async function insertToken(record: AuthToken): Promise<void> {
  await (await tokens()).insertOne({ _id: new ObjectId(), ...record });
}

/** How many unexpired tokens of this purpose the account already has.
 *  The throttle: a person having trouble asks a few times, someone using
 *  us to post mail to an address they do not own asks fifty. */
export async function countActiveTokens(
  userId: string,
  purpose: TokenPurpose,
  now: Date
): Promise<number> {
  return (await tokens()).countDocuments({ userId, purpose, expiresAt: { $gt: now } });
}

export async function tokenQuotaExceeded(
  userId: string,
  purpose: TokenPurpose,
  now: Date
): Promise<boolean> {
  return (await countActiveTokens(userId, purpose, now)) >= MAX_ACTIVE_TOKENS;
}

/** Finds and deletes in one operation.
 *
 *  Single use has to be atomic, not read-then-delete: two requests
 *  arriving together — an email client prefetching the link while the
 *  reader also clicks it is the ordinary case, not a contrived one —
 *  would otherwise both find the token and both succeed. */
export async function consumeToken(tokenHash: string): Promise<AuthToken | null> {
  const doc = await (await tokens()).findOneAndDelete({ tokenHash });
  if (!doc) return null;
  const { _id, ...record } = doc;
  return record;
}

/** Invalidates every outstanding token of a purpose for an account —
 *  after a successful reset, so the other links in that inbox die. */
export async function deleteTokensFor(userId: string, purpose: TokenPurpose): Promise<number> {
  const result = await (await tokens()).deleteMany({ userId, purpose });
  return result.deletedCount ?? 0;
}
