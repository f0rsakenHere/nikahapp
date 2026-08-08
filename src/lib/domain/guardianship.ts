/* The wali link: its lifecycle, and who it entitles to read what.
 *
 * docs/APP-PLAN.md §5.3 for the document, §7.2 for the authorisation
 * rules. Pure — no database, no clock, no I/O — so every path including
 * the illegal ones can be enumerated in tests. `now` is always passed in.
 *
 * Two things here are load-bearing rather than incidental:
 *
 *   1. A sister's profile cannot go live without a confirmed
 *      guardianship. That is the central published promise, and the live
 *      registration form does not enforce it — a real submission arrived
 *      with the entire wali block blank. See `profileMayGoLive`.
 *
 *   2. A wali may read one family's correspondence and no other. §7.2:
 *      "a wali reading another family's conversation is a catastrophic
 *      bug, not a defect." The predicates below are deliberately
 *      paranoid: they check the ward as well as the wali, because a
 *      guardianship handle alone is not proof of anything.
 */
import { z } from "zod";

/* ------------------------------------------------------------- states --- */

export const GUARDIANSHIP_STATES = [
  "invited", //   sent to him; he has not acted
  "confirmed", // he has an account and accepted — the only active state
  "declined", //  he said no
  "expired", //   he never answered and the invitation lapsed
  "revoked", //   the member or staff removed him
  "replaced", //  superseded by a later guardianship
] as const;

export type GuardianshipState = (typeof GUARDIANSHIP_STATES)[number];

/** States from which nothing further can happen. */
export const TERMINAL_STATES: ReadonlySet<GuardianshipState> = new Set([
  "declined",
  "expired",
  "revoked",
  "replaced",
]);

/* ------------------------------------------------------------- schema --- */

export const VerificationState = z.enum(["unverified", "pending", "verified", "failed"]);

export const GuardianshipSchema = z
  .object({
    id: z.string().min(1),
    memberUserId: z.string().min(1),
    memberProfileId: z.string().min(1),

    /* Null until he accepts and creates an account. He is a first-class
     * user with his own portal, not a contact record. */
    waliUserId: z.string().min(1).nullable(),

    invited: z.object({
      name: z.string().min(1),
      relationship: z.string().min(1),
      email: z.email(),
      phone: z.string().min(1).optional(),
      invitedAt: z.date(),
      /* The digest, never the token. §7.1 calls this the most
       * security-sensitive link in the system — it grants a man read
       * access to a woman's private correspondence — so a leaked
       * database dump must not hand anyone a working invitation. The
       * plaintext exists once, in the email, and nowhere else. */
      tokenHash: z.string().length(64),
      expiresAt: z.date(),
      remindersSent: z.number().int().min(0),
    }),

    status: z.enum(GUARDIANSHIP_STATES),

    confirmedAt: z.date().nullable(),
    declinedAt: z.date().nullable(),
    declineReason: z.string().nullable(),
    revokedAt: z.date().nullable(),
    revokedBy: z.string().nullable(),
    expiredAt: z.date().nullable(),

    /* D10 — recommendation is that he is identity-verified. He holds a
     * veto over a woman's marriage prospects and reads her private
     * correspondence; taking that on trust is not defensible. */
    verification: z.object({
      state: VerificationState,
      verifiedAt: z.date().nullable(),
      method: z.string().nullable(),
    }),

    replacesGuardianshipId: z.string().nullable(),
    replacedByGuardianshipId: z.string().nullable(),
  })
  /* A man cannot be his own ward's wali by being the ward. Roles are an
   * array precisely so a brother can be his sister's wali (§2.3) — but
   * never the same account on both sides of one guardianship. */
  .refine((g) => g.waliUserId === null || g.waliUserId !== g.memberUserId, {
    message: "a member cannot be their own wali",
    path: ["waliUserId"],
  })
  /* Makes "confirmed but nobody is actually the wali" unrepresentable,
   * rather than something the authorisation layer has to defend against. */
  .refine((g) => g.status !== "confirmed" || (g.waliUserId !== null && g.confirmedAt !== null), {
    message: "a confirmed guardianship needs a wali account and a confirmation time",
    path: ["status"],
  });

export type Guardianship = z.infer<typeof GuardianshipSchema>;

/* Who a wali can be. Islamically he is a male relative on the father's
 * side, in a defined order of precedence; "someone else" is here because
 * that order breaks in real families — a revert with no Muslim relatives,
 * or a woman whose father has died and whose brothers are not practising
 * — and the answer then is usually a local imam. Staff need to see which
 * case they are looking at, so it is a field rather than free text.
 *
 * ⚠ Needs the scholar's review alongside the rest of §3.4. */
export const WALI_RELATIONSHIPS = [
  "father",
  "grandfather",
  "brother",
  "uncle",
  "sonOfBrother",
  "imam",
  "other",
] as const;

export type WaliRelationship = (typeof WALI_RELATIONSHIPS)[number];

/* ------------------------------------------------------------- events --- */

export type GuardianshipEvent =
  | { type: "accept"; at: Date; waliUserId: string }
  | { type: "decline"; at: Date; reason?: string }
  | { type: "expire"; at: Date }
  | { type: "remind"; at: Date }
  | { type: "revoke"; at: Date; by: string; reason?: string }
  | { type: "replace"; at: Date; replacedByGuardianshipId: string };

export type TransitionError =
  | "illegal-transition"
  | "invitation-expired"
  | "not-yet-expired"
  | "wali-cannot-be-the-member"
  | "member-already-has-confirmed-wali"
  | "reminder-limit-reached"
  | "missing-replacement";

export type TransitionResult =
  | { ok: true; next: Guardianship }
  | { ok: false; error: TransitionError };

/** Everything the machine needs that is not on the document itself.
 *
 *  `memberHasOtherConfirmedWali` is the one cross-document rule: §5.3
 *  requires at most one confirmed guardianship per member. The repository
 *  answers it; the machine only enforces it. */
export type TransitionContext = {
  memberHasOtherConfirmedWali: boolean;
  /** D14 is undecided, so the cadence is injected rather than assumed. */
  maxReminders: number;
};

/* Which events are legal from which state. Everything absent is illegal,
 * and stays illegal when a new event type is added — the default is no. */
const ALLOWED: Record<GuardianshipState, ReadonlySet<GuardianshipEvent["type"]>> = {
  invited: new Set(["accept", "decline", "expire", "remind", "revoke"]),
  /* A wali who steps down after confirming is a `revoke` with `by` set to
   * his own user id — not a `decline`. Keeping `declined` to mean "never
   * took the role" leaves the two distinguishable in the record, which
   * matters: staff read this history to decide whether to ask him again,
   * and "refused from the start" and "served, then withdrew" call for
   * different conversations with the family. */
  confirmed: new Set(["revoke", "replace"]),
  declined: new Set([]),
  expired: new Set([]),
  revoked: new Set([]),
  replaced: new Set([]),
};

/** `(guardianship, event, context) → guardianship | error`. Never throws,
 *  never mutates its input. */
export function transition(
  g: Guardianship,
  event: GuardianshipEvent,
  ctx: TransitionContext
): TransitionResult {
  if (!ALLOWED[g.status].has(event.type)) return { ok: false, error: "illegal-transition" };

  switch (event.type) {
    case "accept": {
      if (event.waliUserId === g.memberUserId) {
        return { ok: false, error: "wali-cannot-be-the-member" };
      }
      /* An expired invitation is not merely stale — the link in an old
       * email is a credential, and honouring it indefinitely means a
       * forwarded message from years ago still confers read access to a
       * woman's private correspondence. */
      if (event.at >= g.invited.expiresAt) {
        return { ok: false, error: "invitation-expired" };
      }
      if (ctx.memberHasOtherConfirmedWali) {
        return { ok: false, error: "member-already-has-confirmed-wali" };
      }
      return {
        ok: true,
        next: { ...g, status: "confirmed", waliUserId: event.waliUserId, confirmedAt: event.at },
      };
    }

    case "decline":
      return {
        ok: true,
        next: {
          ...g,
          status: "declined",
          declinedAt: event.at,
          declineReason: event.reason ?? null,
        },
      };

    case "expire": {
      /* Expiring early would silently cancel a live invitation. The job
       * that sweeps for these runs on a schedule and can drift. */
      if (event.at < g.invited.expiresAt) return { ok: false, error: "not-yet-expired" };
      return { ok: true, next: { ...g, status: "expired", expiredAt: event.at } };
    }

    case "remind": {
      if (g.invited.remindersSent >= ctx.maxReminders) {
        return { ok: false, error: "reminder-limit-reached" };
      }
      return {
        ok: true,
        next: { ...g, invited: { ...g.invited, remindersSent: g.invited.remindersSent + 1 } },
      };
    }

    case "revoke":
      return {
        ok: true,
        next: {
          ...g,
          status: "revoked",
          revokedAt: event.at,
          revokedBy: event.by,
          declineReason: event.reason ?? g.declineReason,
        },
      };

    case "replace": {
      if (!event.replacedByGuardianshipId) return { ok: false, error: "missing-replacement" };
      return {
        ok: true,
        next: {
          ...g,
          status: "replaced",
          replacedByGuardianshipId: event.replacedByGuardianshipId,
        },
      };
    }
  }
}

/* ----------------------------------------------------- authorisation --- */

/** The only active state. Written as a function so call sites read as
 *  intent rather than as a string comparison. */
export function isActive(g: Guardianship): boolean {
  return g.status === "confirmed";
}

export type ActiveLookup =
  | { ok: true; guardianship: Guardianship | null }
  | { ok: false; error: "multiple-confirmed-guardianships" };

/** The member's current wali link, if any.
 *
 *  Returns an error rather than picking one when the invariant is broken.
 *  Two confirmed guardianships means two men can read her correspondence,
 *  and quietly choosing the newer would hide that from everyone. */
export function activeGuardianship(all: readonly Guardianship[]): ActiveLookup {
  const confirmed = all.filter(isActive);
  if (confirmed.length > 1) return { ok: false, error: "multiple-confirmed-guardianships" };
  return { ok: true, guardianship: confirmed[0] ?? null };
}

/** May this account act as wali for this ward, right now?
 *
 *  Both identities are checked. Passing only the wali's id would let a
 *  confirmed wali operate on any guardianship handle he could obtain,
 *  which is the exact failure §7.2 calls catastrophic. */
export function canWaliAct(
  g: Guardianship,
  actor: { waliUserId: string; memberUserId: string }
): boolean {
  return (
    isActive(g) && g.waliUserId === actor.waliUserId && g.memberUserId === actor.memberUserId
  );
}

/** D11 — a replacement wali starts fresh.
 *
 *  He may read conversations that opened while he held the role, and not
 *  the correspondence that preceded him. The history stays available to
 *  staff. Encoded as a time bound rather than a flag so it holds for a
 *  conversation opened *during* a handover as well. */
export function canWaliReadConversation(
  g: Guardianship,
  actor: { waliUserId: string; memberUserId: string },
  conversation: { openedAt: Date }
): boolean {
  if (!canWaliAct(g, actor)) return false;
  if (g.confirmedAt === null) return false;
  return conversation.openedAt >= g.confirmedAt;
}

export type GoLiveResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no-guardianship"
        | "guardianship-not-confirmed"
        | "multiple-confirmed-guardianships"
        | "wali-not-verified";
    };

/** Whether a profile may enter the pool.
 *
 *  Brothers pass without a guardianship — they supply a reference
 *  instead (§2.3). For sisters this is the gate the marketing copy
 *  promises and the live intake form does not enforce.
 *
 *  `requireVerifiedWali` is a parameter because D10 is a recommendation,
 *  not yet a decision. Default on: he can veto a marriage and read
 *  private correspondence. */
export function profileMayGoLive(
  gender: "brother" | "sister",
  guardianships: readonly Guardianship[],
  options: { requireVerifiedWali?: boolean } = {}
): GoLiveResult {
  if (gender === "brother") return { ok: true };

  const active = activeGuardianship(guardianships);
  if (!active.ok) return { ok: false, reason: "multiple-confirmed-guardianships" };

  const g = active.guardianship;
  if (!g) {
    /* Distinguish "never invited anyone" from "invited someone who has
     * not answered" — the two need different words on screen and a
     * different action from staff. */
    return {
      ok: false,
      reason: guardianships.length === 0 ? "no-guardianship" : "guardianship-not-confirmed",
    };
  }

  const requireVerified = options.requireVerifiedWali ?? true;
  if (requireVerified && g.verification.state !== "verified") {
    return { ok: false, reason: "wali-not-verified" };
  }

  return { ok: true };
}
