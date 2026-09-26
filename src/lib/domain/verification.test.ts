import { describe, expect, it } from "vitest";
import {
  VERIFICATION_KINDS,
  VerificationSchema,
  apply,
  requiredFor,
  verificationGaps,
  type Verification,
  type VerificationKind,
} from "./verification";

const NOW = new Date("2026-08-08T10:00:00Z");
const LATER = new Date("2026-08-09T10:00:00Z");

function make(over: Partial<Verification> = {}): Verification {
  return VerificationSchema.parse({
    id: "v1",
    subject: { type: "member", userId: "m1" },
    kind: "identity",
    documents: [],
    reference: null,
    call: null,
    decision: "pending",
    decidedBy: null,
    decidedAt: null,
    reason: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  });
}

const doc = (deletedAt: Date | null = null) => ({
  storageKey: "s3://bucket/abc",
  docType: "passport",
  sha256: "a".repeat(64),
  uploadedAt: NOW,
  deletedAt,
});

describe("VerificationSchema", () => {
  it("accepts a pending check", () => {
    expect(VerificationSchema.safeParse(make()).success).toBe(true);
  });

  it("requires a decided check to say who decided and when", () => {
    const bad = { ...make(), decision: "approved" as const };
    expect(VerificationSchema.safeParse(bad).success).toBe(false);
  });

  it("requires a rejection to carry a reason", () => {
    const noReason = {
      ...make(),
      decision: "rejected" as const,
      decidedBy: "s1",
      decidedAt: NOW,
      reason: "   ",
    };
    expect(VerificationSchema.safeParse(noReason).success).toBe(false);
  });

  /* D17. The most valuable retention rule in the system. */
  it("makes a decided identity check with a surviving document unrepresentable", () => {
    const undeleted = {
      ...make({ documents: [doc()] }),
      decision: "approved" as const,
      decidedBy: "s1",
      decidedAt: NOW,
    };
    expect(VerificationSchema.safeParse(undeleted).success).toBe(false);

    const deleted = { ...undeleted, documents: [doc(NOW)] };
    expect(VerificationSchema.safeParse(deleted).success).toBe(true);
  });

  it("lets a pending identity check hold a live document", () => {
    expect(VerificationSchema.safeParse(make({ documents: [doc()] })).success).toBe(true);
  });
});

describe("requiredFor", () => {
  it("asks for identity, and for nothing that needs a telephone", () => {
    /* The reference call and the intake call were both calls, and the
       product makes none: it no longer asks a brother for somebody to
       ring, and no screen promises a member that we will ring them.
       Leaving either required would hold every profile behind a call
       that is never going to happen. */
    for (const gender of ["brother", "sister"] as const) {
      expect(requiredFor(gender)).toEqual(["identity"]);
    }
  });
});

describe("verificationGaps", () => {
  const approved = (kind: VerificationKind) => ({ kind, decision: "approved" as const });

  it("reports everything missing for a fresh member", () => {
    expect(verificationGaps("brother", [])).toEqual([
      { kind: "identity", reason: "missing" },
    ]);
  });

  it("is empty once every required check has passed", () => {
    expect(verificationGaps("sister", [approved("identity")])).toEqual([]);
  });

  it("ignores a check that is not required for this member", () => {
    /* A member with stray checks from when calls were required still
       needs nothing more. */
    expect(
      verificationGaps("sister", [approved("identity"), approved("intakeCall"), approved("reference")])
    ).toEqual([]);
  });

  it("reports a pending check as pending rather than missing", () => {
    const gaps = verificationGaps("brother", [{ kind: "identity", decision: "pending" }]);
    expect(gaps).toEqual([{ kind: "identity", reason: "pending" }]);
  });

  it("lets a later approval clear an earlier rejection", () => {
    /* Asking for a clearer photograph is the ordinary shape of this. */
    const gaps = verificationGaps("sister", [
      { kind: "identity", decision: "rejected" },
      { kind: "identity", decision: "approved" },
    ]);
    expect(gaps).toEqual([]);
  });

  it("reports a rejection ahead of a pending retry", () => {
    const gaps = verificationGaps("sister", [
      { kind: "identity", decision: "rejected" },
      { kind: "identity", decision: "pending" },
    ]);
    expect(gaps).toEqual([{ kind: "identity", reason: "rejected" }]);
  });
});

describe("apply — decisions", () => {
  it("approves, and deletes the document in the same operation", () => {
    const result = apply(make({ documents: [doc()] }), { type: "approve", at: LATER, by: "s1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.decision).toBe("approved");
    expect(result.next.documents[0].deletedAt).toEqual(LATER);
    expect(VerificationSchema.safeParse(result.next).success).toBe(true);
  });

  it("refuses a rejection with no reason", () => {
    const result = apply(make(), { type: "reject", at: LATER, by: "s1", reason: "  " });
    expect(!result.ok && result.error).toBe("reason-required");
  });

  it("refuses to decide twice", () => {
    const first = apply(make(), { type: "approve", at: LATER, by: "s1" });
    if (!first.ok) throw new Error("setup");
    const second = apply(first.next, { type: "reject", at: LATER, by: "s2", reason: "changed my mind" });
    expect(!second.ok && second.error).toBe("already-decided");
  });

  it("lets a check be sent back for more, and decided afterwards", () => {
    const more = apply(make(), { type: "askForMore", at: LATER, by: "s1", reason: "too blurry" });
    expect(more.ok).toBe(true);
    if (!more.ok) return;
    expect(more.next.decision).toBe("moreInfoNeeded");

    const then = apply(more.next, { type: "approve", at: LATER, by: "s1" });
    expect(then.ok).toBe(true);
  });

  it("does not mutate its input", () => {
    const v = make({ documents: [doc()] });
    apply(v, { type: "approve", at: LATER, by: "s1" });
    expect(v.decision).toBe("pending");
    expect(v.documents[0].deletedAt).toBeNull();
  });
});

describe("apply — the reference call", () => {
  const reference = make({ kind: "reference" });

  it("records what the reference said", () => {
    const result = apply(reference, {
      type: "recordReferenceCall",
      at: LATER,
      by: "s1",
      outcome: "vouched",
      notes: "spoke to him at the masjid",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.reference?.outcome).toBe("vouched");
    expect(result.next.reference?.contactedAt).toEqual(LATER);
  });

  it("records an unreachable reference as an outcome, not a silence", () => {
    const result = apply(reference, {
      type: "recordReferenceCall",
      at: LATER,
      by: "s1",
      outcome: "unreachable",
    });
    expect(result.ok && result.next.reference?.outcome).toBe("unreachable");
  });

  it("refuses on a check of the wrong kind", () => {
    const result = apply(make({ kind: "identity" }), {
      type: "recordReferenceCall",
      at: LATER,
      by: "s1",
      outcome: "vouched",
    });
    expect(!result.ok && result.error).toBe("wrong-kind");
  });
});

describe("apply — the intake call", () => {
  const call = make({ kind: "intakeCall" });

  it("schedules, then completes", () => {
    const scheduled = apply(call, { type: "scheduleCall", at: NOW, by: "s1", scheduledFor: LATER });
    expect(scheduled.ok).toBe(true);
    if (!scheduled.ok) return;

    const done = apply(scheduled.next, { type: "completeCall", at: LATER, by: "s1", notes: "spoke for 20 minutes" });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.next.call?.completedAt).toEqual(LATER);
    expect(done.next.call?.staffUserId).toBe("s1");
  });

  it("refuses to complete a call that was never arranged", () => {
    const result = apply(call, { type: "completeCall", at: LATER, by: "s1" });
    expect(!result.ok && result.error).toBe("call-not-scheduled");
  });

  it("refuses scheduling on a check of the wrong kind", () => {
    const result = apply(make({ kind: "identity" }), {
      type: "scheduleCall",
      at: NOW,
      by: "s1",
      scheduledFor: LATER,
    });
    expect(!result.ok && result.error).toBe("wrong-kind");
  });
});

describe("the kinds that are no longer required", () => {
  it("keeps them in the schema, so old records still open", () => {
    /* `reference` and `intakeCall` records were written while calls were
       part of the process. They are not asked for any more, and a staff
       screen must still be able to read the ones that exist. */
    expect(VERIFICATION_KINDS).toContain("reference");
    expect(VERIFICATION_KINDS).toContain("intakeCall");
    for (const gender of ["brother", "sister"] as const) {
      expect(requiredFor(gender)).not.toContain("reference");
      expect(requiredFor(gender)).not.toContain("intakeCall");
    }
  });
});
