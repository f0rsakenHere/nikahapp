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
