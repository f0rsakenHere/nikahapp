"use server";

/* Staff decisions on a profile. */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { record } from "@/lib/audit";
import { currentUser } from "@/lib/auth/current";
import { can, isStaffActor } from "@/lib/domain/authorisation";
import { submitBlockers } from "@/lib/domain/profile";
import { decideProfile, findProfileById } from "@/lib/repositories/profiles";
import { hasConfirmedWali, listGuardianshipsForMember } from "@/lib/repositories/guardianships";
import { listVerificationsFor } from "@/lib/repositories/verifications";
import { verificationGaps } from "@/lib/domain/verification";

export type DecisionState = { error?: string; done?: string };

/** The signed-in staff member, or a redirect. Every admin screen and
 *  action starts here, so "is this person staff" is asked in one place. */
export async function requireStaff() {
  const session = await currentUser();
  if (!session) redirect("/login?next=/admin");
  if (!isStaffActor(session.user.roles)) redirect("/onboarding");
  return session;
}

export async function decide(
  profileId: string,
  _prev: DecisionState,
  form: FormData
): Promise<DecisionState> {
  const { user } = await requireStaff();

  const actor = { userId: user.id, roles: user.roles };
  if (!can(actor, "profile.decide", { type: "member", memberUserId: "" }).allowed) {
    return { error: "Your account cannot decide on profiles. Ask an administrator." };
  }

  const profile = await findProfileById(profileId);
  if (!profile) return { error: "That profile no longer exists." };

  const outcome = String(form.get("decision") ?? "");
  const reason = String(form.get("reason") ?? "").trim();

  if (outcome !== "live" && outcome !== "rejected" && outcome !== "verifying") {
    return { error: "Choose approve, hold for checks, or decline." };
  }

  /* Approving is the one decision that can contradict the product's
   * central promise, so it is re-checked here rather than trusted from
   * the queue. A sister without a confirmed wali must not go live no
   * matter what a staff member clicks. */
  if (outcome === "live") {
    const blockers = submitBlockers(profile, {
      hasConfirmedWali: await hasConfirmedWali(profile.userId),
    });
    if (blockers.length) {
      const wali = blockers.find((b) => b.reason === "wali-not-confirmed");
      return {
        error: wali
          ? "Her wali has not confirmed. This profile cannot go live yet."
          : `Not ready: ${blockers.map((b) => b.step).join(", ")} unfinished.`,
      };
    }

    /* Nobody goes live unchecked. The published process puts identity,
     * references and a phone call before matching, and this is the only
     * place that is actually true rather than merely written down. */
    const gaps = verificationGaps(profile.gender, await listVerificationsFor(profile.userId));
    if (gaps.length) {
      return {
        error: `Checks outstanding: ${gaps.map((g) => `${g.kind} (${g.reason})`).join(", ")}.`,
      };
    }

    /* And her wali is checked too (D10) — he holds a veto and reads her
     * correspondence. */
    if (profile.gender === "sister") {
      const active = (await listGuardianshipsForMember(profile.userId)).find(
        (g) => g.status === "confirmed"
      );
      if (active && active.verification.state !== "verified") {
        return { error: "Her wali has not been identity-checked yet." };
      }
    }
  }

  /* A decline without a reason is a decision nobody can explain later —
   * not to the member who asks why, and not to us reading the audit log
   * in a year. */
  if (outcome === "rejected" && reason.length < 3) {
    return { error: "Give a reason. It is recorded, and the member may ask." };
  }

  const result = await decideProfile(profileId, outcome, { userId: user.id, reason }, new Date());
  if (!result.ok) {
    return { error: "Somebody has already decided on this profile. Reload to see the outcome." };
  }

  await record({
    action: outcome === "live" ? "profile.approved" : "profile.rejected",
    subject: { type: "profile", id: profileId },
    actor: { userId: user.id, role: user.roles[0] },
    meta: { outcome, reason: reason || undefined, memberUserId: profile.userId },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/members/${profileId}`);
  return { done: outcome };
}

/** Reading a member's legal name is itself an event (§7.7: "every read
 *  of identity documents or legal names"). Called by the 360 view. */
export async function noteLegalNameRead(memberUserId: string): Promise<void> {
  const { user } = await requireStaff();
  await record({
    action: "staff.viewedLegalName",
    subject: { type: "user", id: memberUserId },
    actor: { userId: user.id, role: user.roles[0] },
  });
}
