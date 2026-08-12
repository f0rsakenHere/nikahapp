/* Leaving: pausing, withdrawing, and erasure.
 *
 * docs/APP-PLAN.md §9 lists this as lifecycle work, but §10.2 makes the
 * last part a legal obligation rather than a feature. Quebec's Law 25
 * and PIPEDA both give a person the right to see what is held about them
 * and to have it deleted, and Law 25 adds portability — the export has
 * to be machine-readable, not a PDF.
 *
 * Built now rather than in Phase 9 because erasure is architectural. It
 * has to reach into every collection that ever held a copy, and the list
 * of those grows with the product. Adding it later means auditing code
 * that has forgotten it exists.
 *
 * Pure — no clock, no I/O.
 */
import type { ProfileStatus } from "./profile";

/* --------------------------------------------------- pause / withdraw -- */

export type LifecycleEvent = "pause" | "resume" | "withdraw";

export type LifecycleError = "cannot-pause" | "not-paused" | "already-gone";

/* Pausing is reversible and keeps everything. Withdrawing is not, and
 * says so on the screen. Deleting is a third thing entirely — it removes
 * the account, and is handled below.
 *
 * The three waiting statuses are here because of D1f. With approval
 * deferred a member is in the pool from the moment they send their
 * profile in, and somebody who can be seen must be able to stop being
 * seen without withdrawing — the only other exit, and a permanent one.
 * They are pausable under the strict setting too, where it costs
 * nothing: pausing something invisible simply keeps it invisible. */
const PAUSABLE: ReadonlySet<ProfileStatus> = new Set([
  "live",
  "matched",
  "pendingCall",
  "pendingReview",
  "verifying",
]);
const GONE: ReadonlySet<ProfileStatus> = new Set(["withdrawn", "rejected"]);

export function nextStatus(
  current: ProfileStatus,
  event: LifecycleEvent,
  /** What `resume` returns to. See `pausedFrom` on the profile. */
  pausedFrom?: ProfileStatus
): { ok: true; status: ProfileStatus } | { ok: false; error: LifecycleError } {
  if (GONE.has(current)) return { ok: false, error: "already-gone" };

  switch (event) {
    case "pause":
      /* A draft cannot be paused: there is nothing to pause it from, and
       * offering it would imply the profile is visible somewhere. */
      if (!PAUSABLE.has(current)) return { ok: false, error: "cannot-pause" };
      return { ok: true, status: "paused" };

    case "resume": {
      if (current !== "paused") return { ok: false, error: "not-paused" };
      /* Back to where they were, not to `live`. Returning everybody to
       * live would hand an approval to a member waiting for one — the
       * pause button quietly doing what the review queue is for.
       * `live` remains the answer when nothing was recorded, which is
       * every profile paused before this was kept. */
      const back = pausedFrom && PAUSABLE.has(pausedFrom) ? pausedFrom : "live";
      return { ok: true, status: back };
    }

    case "withdraw":
      /* Allowed from anywhere that is not already terminal, including a
       * draft. Someone who changes their mind halfway through onboarding
       * is exactly the person most likely to want out. */
      return { ok: true, status: "withdrawn" };
  }
}

/* ---------------------------------------------------------- erasure --- */

/** What happens to each collection when someone asks to be erased.
 *
 *  Written out as data rather than as a sequence of deletes, so the list
 *  can be read, reviewed by counsel, and checked against the collections
 *  that actually exist. A collection missing from here is a collection
 *  nobody decided about. */
export const ERASURE_PLAN = {
  users: "delete",
  profiles: "delete",
  sessions: "delete",
  verificationTokens: "delete",
  verifications: "delete",
  /* His account is not hers to delete. The link goes; if he is wali for
   * somebody else, or wants his own account, that is his to decide. */
  guardianships: "delete",
  /* Append-only, and it must stay that way (§5.10). See below. */
  auditLog: "pseudonymise",
} as const;

export type ErasureAction = (typeof ERASURE_PLAN)[keyof typeof ERASURE_PLAN];

/* ── Why the audit log is pseudonymised rather than deleted ───────────
 *
 * Two rules point in opposite directions. §5.10 says the audit log is
 * append-only, no updates and no deletes, ever — it is how we answer
 * "who read her legal name" years later, and a log with holes punched in
 * it on request is not evidence of anything. Law 25 says a person may
 * have their personal information erased.
 *
 * Both are satisfied by removing the person from the record while
 * keeping the record. The entry keeps its action, its timestamp and the
 * fact that somebody did it; the identifiers become a one-way pseudonym,
 * and the free-form `meta` goes entirely, because that is where anything
 * identifying would have ended up.
 *
 * The pseudonym is derived rather than random so that entries about one
 * person still group together — a staff member investigating "did the
 * same account do this twice" can still answer it, without being able to
 * work backwards to who.
 * ────────────────────────────────────────────────────────────────────── */

export type PseudonymisedEntry = {
  actorUserId: string | null;
  subjectId: string;
  meta: Record<string, never>;
};

/** Replaces one audit entry's identifiers. `pseudonym` comes from the
 *  caller, which is what does the hashing — this decides only what is
 *  replaced and what survives. */
export function pseudonymiseEntry(
  entry: { actor: { userId: string | null }; subject: { id: string } },
  erasedUserId: string,
  pseudonym: string
): PseudonymisedEntry {
  return {
    actorUserId: entry.actor.userId === erasedUserId ? pseudonym : entry.actor.userId,
    subjectId: entry.subject.id === erasedUserId ? pseudonym : entry.subject.id,
    meta: {},
  };
}

/* ----------------------------------------------------------- export --- */

/** The shape handed to a member who asks what is held about them.
 *
 *  Law 25 asks for it in a "structured, commonly used technological
 *  format", so it is JSON rather than a rendering of the screens. */
export type DataExport = {
  exportedAt: string;
  account: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  guardianships: Record<string, unknown>[];
  verifications: Record<string, unknown>[];
  activity: { at: string; action: string }[];
};

/* Fields that never leave the server, even to their owner.
 *
 * Not secrecy for its own sake: a password hash and a TOTP secret are
 * credentials, and a session digest is a live one. Handing someone a
 * file containing them — which they will then email to themselves —
 * turns a privacy right into a credential leak. */
const NEVER_EXPORTED = new Set([
  "passwordHash",
  "tokenHash",
  "secret",
  "mfa",
  "_id",
]);

export function redactForExport(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (NEVER_EXPORTED.has(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      out[key] = redactForExport(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}
