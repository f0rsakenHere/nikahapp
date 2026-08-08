"use server";

/* The verifier's actions: identity, the reference call, the intake call,
 * and confirming a wali is who he says he is (D10). */
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { record } from "@/lib/audit";
import { can } from "@/lib/domain/authorisation";
import type { ReferenceOutcome } from "@/lib/domain/verification";
import { applyVerification, findVerificationById } from "@/lib/repositories/verifications";
import { requireStaff } from "./actions";

export type VerifyState = { error?: string; done?: string };

/** Everything here changes somebody's verification, so the permission is
 *  checked once, here, rather than per action. */
async function requireVerifier() {
  const session = await requireStaff();
  const actor = { userId: session.user.id, roles: session.user.roles };
  const allowed =
    can(actor, "member.readIdentityDocuments", { type: "member", memberUserId: "" }).allowed ||
    can(actor, "member.note", { type: "member", memberUserId: "" }).allowed;
  return { session, allowed, actor };
}

export async function decideVerification(
  verificationId: string,
  _prev: VerifyState,
  form: FormData
): Promise<VerifyState> {
  const { session, allowed } = await requireVerifier();
  if (!allowed) return { error: "Your account cannot record verification decisions." };

  const verification = await findVerificationById(verificationId);
  if (!verification) return { error: "That check no longer exists." };

  const outcome = String(form.get("outcome") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  const now = new Date();

  const event =
    outcome === "approve"
      ? ({ type: "approve", at: now, by: session.user.id, note: reason || undefined } as const)
      : outcome === "reject"
        ? ({ type: "reject", at: now, by: session.user.id, reason } as const)
        : outcome === "askForMore"
          ? ({ type: "askForMore", at: now, by: session.user.id, reason } as const)
          : null;

  if (!event) return { error: "Choose an outcome." };

  const result = await applyVerification(verification, event);
  if (!result.ok) {
    return {
      error:
        result.error === "reason-required"
          ? "Give a reason. It is recorded, and the member may ask."
          : result.error === "already-decided"
            ? "Somebody has already decided this check."
            : "That could not be recorded.",
    };
  }

  await record({
    /* Deciding an identity check means somebody looked at the document,
     * which §7.7 wants recorded whether or not the decision changed
     * anything. */
    action:
      verification.kind === "identity"
        ? "staff.viewedIdentityDocuments"
        : "staff.notedMember",
    subject: { type: "verification", id: verificationId },
    actor: { userId: session.user.id, role: session.user.roles[0] },
    meta: { kind: verification.kind, outcome, memberUserId: verification.subject.userId },
  });

  revalidatePath("/admin");
  return { done: outcome };
}

export async function recordReferenceCall(
  verificationId: string,
  _prev: VerifyState,
  form: FormData
): Promise<VerifyState> {
  const { session, allowed } = await requireVerifier();
  if (!allowed) return { error: "Your account cannot record verification calls." };

  const verification = await findVerificationById(verificationId);
  if (!verification) return { error: "That check no longer exists." };

  const result = await applyVerification(verification, {
    type: "recordReferenceCall",
    at: new Date(),
    by: session.user.id,
    outcome: String(form.get("outcome") ?? "") as ReferenceOutcome,
    notes: String(form.get("notes") ?? "").trim() || undefined,
  });
  if (!result.ok) return { error: "That could not be recorded." };

  await record({
    action: "staff.notedMember",
    subject: { type: "verification", id: verificationId },
    actor: { userId: session.user.id, role: session.user.roles[0] },
    meta: { kind: "reference", outcome: String(form.get("outcome") ?? "") },
  });

  revalidatePath("/admin");
  return { done: "reference" };
}

export async function recordIntakeCall(
  verificationId: string,
  _prev: VerifyState,
  form: FormData
): Promise<VerifyState> {
  const { session, allowed } = await requireVerifier();
  if (!allowed) return { error: "Your account cannot record verification calls." };

  const verification = await findVerificationById(verificationId);
  if (!verification) return { error: "That check no longer exists." };

  const now = new Date();
  const scheduledFor = String(form.get("scheduledFor") ?? "");
  const completing = form.get("completing") === "on";

  const result = await applyVerification(
    verification,
    completing
      ? { type: "completeCall", at: now, by: session.user.id, notes: String(form.get("notes") ?? "").trim() || undefined }
      : {
          type: "scheduleCall",
          at: now,
          by: session.user.id,
          scheduledFor: scheduledFor ? new Date(`${scheduledFor}T00:00:00Z`) : now,
        }
  );

  if (!result.ok) {
    return {
      error:
        result.error === "call-not-scheduled"
          ? "Arrange the call before marking it done."
          : "That could not be recorded.",
    };
  }

  await record({
    action: "staff.notedMember",
    subject: { type: "verification", id: verificationId },
    actor: { userId: session.user.id, role: session.user.roles[0] },
    meta: { kind: "intakeCall", step: completing ? "completed" : "scheduled" },
  });

  revalidatePath("/admin");
  return { done: completing ? "call-completed" : "call-scheduled" };
}

/** D10 — the wali holds a veto over a woman's marriage prospects and
 *  reads her private correspondence. Taking that on trust is not
 *  defensible, so his check lives on the guardianship and is recorded
 *  here by a person, not inferred. */
export async function verifyWali(
  guardianshipId: string,
  _prev: VerifyState,
  form: FormData
): Promise<VerifyState> {
  const { session, allowed } = await requireVerifier();
  if (!allowed) return { error: "Your account cannot verify a wali." };

  const method = String(form.get("method") ?? "").trim();
  if (!method) return { error: "Say how he was checked — it is the whole point of the record." };

  const now = new Date();
  const result = await (await getDb())
    .collection(COLLECTIONS.guardianships)
    .updateOne(
      { _id: new ObjectId(guardianshipId), status: "confirmed" },
      { $set: { "verification.state": "verified", "verification.verifiedAt": now, "verification.method": method } }
    );

  if (result.matchedCount !== 1) return { error: "That guardianship is not confirmed." };

  await record({
    action: "guardianship.confirmed",
    subject: { type: "guardianship", id: guardianshipId },
    actor: { userId: session.user.id, role: session.user.roles[0] },
    meta: { verified: true, method },
  });

  revalidatePath("/admin");
  return { done: "wali-verified" };
}
