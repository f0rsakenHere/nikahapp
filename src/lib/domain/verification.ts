/* Checking that people are who they say they are.
 *
 * docs/APP-PLAN.md §5.4. Three separate checks, deliberately separate:
 *
 *   identity    a document, reviewed and then deleted (D17)
 *   reference   a telephone call to somebody who knows them
 *   intakeCall  the call the live site promises — "we will speak with
 *               you by phone before any matching begins"
 *
 * Kept apart rather than rolled into one "verified" flag because they
 * fail differently and are done by different people at different times.
 * A profile held for a reference who will not answer the phone is a
 * different problem from one held for a blurry passport photograph, and
 * a single flag cannot tell staff which they are looking at.
 *
 * Pure — no clock, no I/O.
 */
import { z } from "zod";

export const VERIFICATION_KINDS = ["identity", "reference", "intakeCall"] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];

export const VERIFICATION_DECISIONS = [
  "pending",
  "approved",
  "rejected",
  "moreInfoNeeded",
] as const;
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

/** What a reference said, when someone finally reached them. */
export const REFERENCE_OUTCOMES = [
  "vouched",
  "declinedToComment",
  "concerns",
  "unreachable",
  "wrongNumber",
] as const;
export type ReferenceOutcome = (typeof REFERENCE_OUTCOMES)[number];

export const VerificationSchema = z
  .object({
    id: z.string().min(1),
    subject: z.object({
      type: z.enum(["member", "wali"]),
      userId: z.string().min(1),
    }),
    kind: z.enum(VERIFICATION_KINDS),

    /* 🔒 Deleted once a decision is recorded (D17). The decision, the
     * document type and a hash are kept; the image never is. That shrinks
     * the blast radius of a breach enormously for very little
     * operational cost, and it is the single most valuable retention
     * rule in this system. */
    documents: z
      .array(
        z.object({
          storageKey: z.string().min(1),
          docType: z.string().min(1),
          sha256: z.string().length(64).nullable(),
          uploadedAt: z.date(),
          deletedAt: z.date().nullable(),
        })
      )
      .default([]),

    /* 🔒 notes */
    reference: z
      .object({
        name: z.string().min(1).optional(),
        relationship: z.string().optional(),
        organisation: z.string().optional(),
        phone: z.string().optional(),
        contactedAt: z.date().nullable(),
        outcome: z.enum(REFERENCE_OUTCOMES).nullable(),
        notes: z.string().max(4000).optional(),
      })
      .nullable()
      .default(null),

    /* 🔒 notes */
    call: z
      .object({
        scheduledFor: z.date().nullable(),
        completedAt: z.date().nullable(),
        staffUserId: z.string().nullable(),
        notes: z.string().max(4000).optional(),
      })
      .nullable()
      .default(null),

    decision: z.enum(VERIFICATION_DECISIONS),
    decidedBy: z.string().nullable(),
    decidedAt: z.date().nullable(),
    reason: z.string().max(2000).nullable(),

    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .refine((v) => v.decision === "pending" || (v.decidedBy !== null && v.decidedAt !== null), {
    message: "a decided verification must record who decided and when",
    path: ["decidedBy"],
  })
  .refine((v) => v.decision !== "rejected" || (v.reason ?? "").trim().length > 0, {
    /* A rejection nobody can explain is no use to the member who asks,
     * to the staff member who inherits the case, or to us reading the
     * audit log in a year. */
    message: "a rejection must record a reason",
    path: ["reason"],
  })
  /* The image must not survive the decision. Enforced in the schema so
   * that a document left undeleted is unrepresentable rather than
   * merely discouraged. */
  .refine(
    (v) =>
      v.decision === "pending" ||
      v.kind !== "identity" ||
      v.documents.every((d) => d.deletedAt !== null),
    {
      message: "identity documents must be deleted once a decision is recorded",
      path: ["documents"],
    }
  );

export type Verification = z.infer<typeof VerificationSchema>;

/* ---------------------------------------------------------- required -- */

/** Which checks a member needs before their profile may go live.
 *
 *  A brother supplies a reference; a sister supplies a wali, and his
 *  check lives on the guardianship rather than here (§5.3). Everyone
 *  gets the intake call, because the live site promises it to everyone. */
export function requiredFor(gender: "brother" | "sister"): VerificationKind[] {
  return gender === "brother"
    ? ["identity", "reference", "intakeCall"]
    : ["identity", "intakeCall"];
}

export type VerificationGap =
  | { kind: VerificationKind; reason: "missing" }
  | { kind: VerificationKind; reason: "pending" }
  | { kind: VerificationKind; reason: "rejected" }
  | { kind: VerificationKind; reason: "moreInfoNeeded" };

/** What still stands between this member and a live profile.
 *
 *  Reports every gap rather than the first, so staff see the whole
 *  picture on one screen instead of clearing one and discovering
 *  another. */
export function verificationGaps(
  gender: "brother" | "sister",
  verifications: readonly Pick<Verification, "kind" | "decision">[]
): VerificationGap[] {
  const gaps: VerificationGap[] = [];

  for (const kind of requiredFor(gender)) {
    const found = verifications.filter((v) => v.kind === kind);
    if (found.length === 0) {
      gaps.push({ kind, reason: "missing" });
      continue;
    }
    /* Approved once is enough — a second attempt after a rejection is
     * the normal shape of "we asked for a clearer photograph". */
    if (found.some((v) => v.decision === "approved")) continue;

    const worst = found.find((v) => v.decision === "rejected")
      ? "rejected"
      : found.find((v) => v.decision === "moreInfoNeeded")
        ? "moreInfoNeeded"
        : "pending";
    gaps.push({ kind, reason: worst });
  }

  return gaps;
}

/* -------------------------------------------------------- transitions -- */

export type VerificationEvent =
  | { type: "approve"; at: Date; by: string; note?: string }
  | { type: "reject"; at: Date; by: string; reason: string }
  | { type: "askForMore"; at: Date; by: string; reason: string }
  | { type: "recordReferenceCall"; at: Date; by: string; outcome: ReferenceOutcome; notes?: string }
  | { type: "scheduleCall"; at: Date; by: string; scheduledFor: Date }
  | { type: "completeCall"; at: Date; by: string; notes?: string };

export type VerificationError =
  | "already-decided"
  | "wrong-kind"
  | "reason-required"
  | "documents-not-deleted"
  | "call-not-scheduled";

export type VerificationResult =
  | { ok: true; next: Verification }
  | { ok: false; error: VerificationError };

/** `(verification, event) → verification | error`. Never throws, never
 *  mutates. */
export function apply(v: Verification, event: VerificationEvent): VerificationResult {
  const decided = v.decision === "approved" || v.decision === "rejected";

  switch (event.type) {
    case "approve":
    case "reject":
    case "askForMore": {
      if (decided) return { ok: false, error: "already-decided" };

      if (event.type !== "approve" && !event.reason.trim()) {
        return { ok: false, error: "reason-required" };
      }

      /* The image goes when the decision lands, in the same operation —
       * not on a later sweep that might not run. */
      const documents =
        v.kind === "identity"
          ? v.documents.map((d) => ({ ...d, deletedAt: d.deletedAt ?? event.at }))
          : v.documents;

      const decision =
        event.type === "approve"
          ? "approved"
          : event.type === "reject"
            ? "rejected"
            : "moreInfoNeeded";

      return {
        ok: true,
        next: {
          ...v,
          documents,
          decision,
          decidedBy: event.by,
          decidedAt: event.at,
          reason: event.type === "approve" ? (event.note ?? null) : event.reason,
          updatedAt: event.at,
        },
      };
    }

    case "recordReferenceCall": {
      if (v.kind !== "reference") return { ok: false, error: "wrong-kind" };
      if (decided) return { ok: false, error: "already-decided" };
      return {
        ok: true,
        next: {
          ...v,
          reference: {
            ...(v.reference ?? { contactedAt: null, outcome: null }),
            contactedAt: event.at,
            outcome: event.outcome,
            notes: event.notes ?? v.reference?.notes,
          },
          updatedAt: event.at,
        },
      };
    }

    case "scheduleCall": {
      if (v.kind !== "intakeCall") return { ok: false, error: "wrong-kind" };
      if (decided) return { ok: false, error: "already-decided" };
      return {
        ok: true,
        next: {
          ...v,
          call: {
            ...(v.call ?? { completedAt: null, staffUserId: null }),
            scheduledFor: event.scheduledFor,
          },
          updatedAt: event.at,
        },
      };
    }

    case "completeCall": {
      if (v.kind !== "intakeCall") return { ok: false, error: "wrong-kind" };
      if (decided) return { ok: false, error: "already-decided" };
      /* A call marked complete that was never arranged is usually a
       * misclick on the wrong row. */
      if (!v.call?.scheduledFor) return { ok: false, error: "call-not-scheduled" };
      return {
        ok: true,
        next: {
          ...v,
          call: {
            ...v.call,
            completedAt: event.at,
            staffUserId: event.by,
            notes: event.notes ?? v.call.notes,
          },
          updatedAt: event.at,
        },
      };
    }
  }
}
