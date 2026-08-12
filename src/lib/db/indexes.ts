/* Index definitions for the collections that exist so far.
 *
 * ⚠ A STOPGAP. docs/APP-PLAN.md §5.13 commits to `migrate-mongo` with
 * numbered, reversible scripts run in CI against staging — and that is
 * still the plan. This exists because the unique index on `users.email`
 * is not an optimisation: without it two simultaneous sign-ups both
 * succeed and one person ends up unable to sign in. Waiting for the
 * migration tooling to be set up would mean shipping auth without it.
 *
 * When migration `001` lands, it takes these over and this file goes.
 *
 * `createIndexes` is idempotent — re-running is free, and an index whose
 * definition has changed raises an error rather than being silently
 * ignored, which is the behaviour we want.
 */
import type { CreateIndexesOptions, IndexSpecification } from "mongodb";
import { COLLECTIONS, type CollectionName } from "./collections";
import { getDb } from "./client";

type Spec = { keys: IndexSpecification; options: CreateIndexesOptions };

export const INDEXES: Partial<Record<CollectionName, Spec[]>> = {
  [COLLECTIONS.users]: [
    { keys: { email: 1 }, options: { unique: true, name: "email_unique" } },
    { keys: { roles: 1, status: 1 }, options: { name: "roles_status" } },
    { keys: { "phone.e164": 1 }, options: { name: "phone_e164", sparse: true } },
  ],

  [COLLECTIONS.profiles]: [
    { keys: { userId: 1 }, options: { unique: true, name: "userId_unique" } },
    { keys: { status: 1, gender: 1 }, options: { name: "status_gender" } },
  ],

  [COLLECTIONS.notifications]: [
    { keys: { userId: 1, createdAt: -1 }, options: { name: "member_recent" } },
    /* The unread count runs on every page that shows the bell, which is
     * all of them. */
    { keys: { userId: 1, readAt: 1 }, options: { name: "member_unread" } },
  ],

  [COLLECTIONS.browseMarks]: [
    /* One mark per pair: saving somebody you passed on replaces the
     * pass rather than leaving both on the record. */
    { keys: { userId: 1, profileId: 1 }, options: { unique: true, name: "member_profile_unique" } },
    { keys: { userId: 1, kind: 1, at: -1 }, options: { name: "member_kind_recent" } },
    /* For erasure: a withdrawn member has to come out of everybody
     * else's saved list too. */
    { keys: { targetUserId: 1 }, options: { name: "target" } },
  ],

  [COLLECTIONS.sessions]: [
    { keys: { tokenHash: 1 }, options: { unique: true, name: "tokenHash_unique" } },
    { keys: { userId: 1, lastSeenAt: -1 }, options: { name: "userId_lastSeen" } },
    /* Mongo sweeps expired documents roughly once a minute, so this is a
     * cleanup mechanism and not a security control. Expiry is enforced
     * on read, in `sessionInvalidReason`; this only stops the collection
     * growing without bound. */
    {
      keys: { absoluteExpiresAt: 1 },
      options: { name: "absoluteExpiresAt_ttl", expireAfterSeconds: 0 },
    },
  ],

  [COLLECTIONS.conversations]: [
    { keys: { requestId: 1 }, options: { unique: true, name: "requestId_unique" } },
    {
      keys: { "participants.userId": 1, state: 1, lastMessageAt: -1 },
      options: { name: "seat_state_recent" },
    },
  ],

  [COLLECTIONS.messages]: [
    { keys: { conversationId: 1, sentAt: 1 }, options: { name: "thread" } },
  ],

  [COLLECTIONS.connectionRequests]: [
    /* One live request per ordered pair. The unique index is what
     * makes two taps produce one request rather than two charges. */
    { keys: { pairKey: 1 }, options: { unique: true, name: "pairKey_unique" } },
    { keys: { toUserId: 1, state: 1 }, options: { name: "inbox" } },
    { keys: { fromUserId: 1, state: 1 }, options: { name: "outbox" } },
    { keys: { state: 1, expiresAt: 1 }, options: { name: "expiry_sweep" } },
  ],

  [COLLECTIONS.connectionLedger]: [
    { keys: { userId: 1, at: -1 }, options: { name: "userId_at" } },
    /* One monthly grant per person per period.
     *
     * `partialFilterExpression`, not `sparse`. A sparse *compound* index
     * still indexes a document when any one of its keys exists — and
     * `userId` always does — so every reservation and refund was indexed
     * with `period: null` and the second one collided. Partial indexes
     * only the documents this rule is about. */
    {
      keys: { userId: 1, period: 1 },
      options: {
        unique: true,
        name: "grant_once_per_period",
        partialFilterExpression: { reason: "monthlyGrant" },
      },
    },
  ],

  [COLLECTIONS.verifications]: [
    { keys: { "subject.userId": 1, kind: 1 }, options: { name: "subject_kind" } },
    { keys: { decision: 1, createdAt: 1 }, options: { name: "decision_createdAt" } },
    { keys: { decision: 1, "call.scheduledFor": 1 }, options: { name: "decision_callAt" } },
  ],

  [COLLECTIONS.auditLog]: [
    { keys: { "subject.type": 1, "subject.id": 1, at: -1 }, options: { name: "subject_at" } },
    { keys: { "actor.userId": 1, at: -1 }, options: { name: "actor_at" } },
    { keys: { action: 1, at: -1 }, options: { name: "action_at" } },
    /* No TTL. §5.10: no updates, no deletes, ever — old entries move to
     * Atlas Online Archive rather than being removed. */
  ],

  [COLLECTIONS.verificationTokens]: [
    { keys: { tokenHash: 1 }, options: { unique: true, name: "tokenHash_unique" } },
    { keys: { userId: 1, purpose: 1 }, options: { name: "userId_purpose" } },
    /* Cleanup only — expiry is enforced on use, in `tokenInvalidReason`.
     * Mongo's TTL monitor runs about once a minute, which is far too
     * loose to be a security control on a one-hour reset link. */
    { keys: { expiresAt: 1 }, options: { name: "expiresAt_ttl", expireAfterSeconds: 0 } },
  ],

  [COLLECTIONS.guardianships]: [
    { keys: { memberUserId: 1, status: 1 }, options: { name: "member_status" } },
    { keys: { waliUserId: 1, status: 1 }, options: { name: "wali_status", sparse: true } },
    {
      keys: { "invited.token": 1 },
      options: { unique: true, sparse: true, name: "invite_token_unique" },
    },
    {
      keys: { status: 1, "invited.expiresAt": 1 },
      options: { name: "status_inviteExpiry" },
    },
  ],
};

export type EnsureIndexesReport = { collection: string; created: string[] }[];

/** Creates every index above. Safe to run repeatedly. */
export async function ensureIndexes(): Promise<EnsureIndexesReport> {
  const db = await getDb();
  const report: EnsureIndexesReport = [];

  for (const [name, specs] of Object.entries(INDEXES) as [CollectionName, Spec[]][]) {
    const created: string[] = [];
    for (const spec of specs) {
      /* `background` is the default and no longer configurable on modern
       * servers; index builds on a replica set do not block writes. */
      created.push(await db.collection(name).createIndex(spec.keys, spec.options));
    }
    report.push({ collection: name, created });
  }

  return report;
}
