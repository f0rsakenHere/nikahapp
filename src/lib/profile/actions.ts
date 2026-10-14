"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current";
import { parseStepForm } from "@/lib/domain/profile-form";
import { stepsFor, submitBlockers, type ProfileDraft, type StepId } from "@/lib/domain/profile";
import {
  findProfileByUserId,
  saveProfileSection,
  submitForReview,
} from "@/lib/repositories/profiles";
import { hasConfirmedWali } from "@/lib/repositories/guardianships";
import { openRequiredChecks } from "@/lib/repositories/verifications";
import { record } from "@/lib/audit";

export type StepState = { issues?: string[] };

/** Saves one step and moves to the next.
 *
 *  Saves whatever was filled in, even if the step is not finished —
 *  "the profile can be finished across several sittings" is a promise
 *  the marketing page makes, and it is worth nothing if leaving halfway
 *  through loses the half. Completeness is reported, never enforced
 *  here; `submitBlockers` is the gate, at the end.
 */
export async function saveStep(step: StepId, _prev: StepState, form: FormData): Promise<StepState> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/onboarding");

  const profile = await findProfileByUserId(session.user.id);
  if (!profile) redirect("/onboarding");

  const ctxBefore = {
    hasConfirmedWali: profile.gender === "sister" ? await hasConfirmedWali(session.user.id) : false,
  };
  const wasIncomplete = submitBlockers(profile, ctxBefore).length > 0;

  const patch = parseStepForm(step, profile.gender, form);
  const saved = await saveProfileSection(session.user.id, patch, new Date());

  if (!saved.ok) return { issues: saved.issues };

  /* The answer that finishes the profile also sends it in.
   *
   * A tester: "the user must then return to home and hit the 'send it to
   * us' button, which is something I expected to be done on its own."
   * He was right — he had answered the last question anybody was waiting
   * on, and the product made him go and find a button to say so.
   *
   * Only on the save that completes it, and only from a draft: editing
   * one answer on a profile that was already finished must not quietly
   * send it, and a profile already with us is not re-sent. */
  if (
    wasIncomplete &&
    profile.status === "draft" &&
    session.user.emailVerifiedAt &&
    submitBlockers(saved.profile, ctxBefore).length === 0
  ) {
    await sendProfileIn(session.user.id, saved.profile, session.user.id);
    revalidatePath("/onboarding");
    redirect("/dashboard?submitted=1");
  }

  revalidatePath("/onboarding");

  /* Forward to the next step this member actually sees — a brother is
   * never shown the wali step, so "the next one" is not step n + 1. */
  const steps = stepsFor(profile.gender);
  const here = steps.findIndex((s) => s.id === step);
  const next = steps[here + 1];
  redirect(next ? `/onboarding/${next.id}` : "/onboarding");
}

/** Sending it in: the status, the checks staff work from, the record.
 *
 *  Shared by the button and by the save that finishes the last step, so
 *  the two cannot drift into doing different amounts of it. */
async function sendProfileIn(userId: string, profile: ProfileDraft, actorUserId: string) {
  const now = new Date();
  await submitForReview(userId, now);

  /* The checks staff will work from, opened at submission rather than
   * when someone first opens the case. A queue that only fills when a
   * reviewer looks at it is a queue that hides its own backlog. */
  await openRequiredChecks(userId, profile.gender, now);

  await record({
    action: "profile.submitted",
    subject: { type: "profile", id: profile.id },
    actor: { userId: actorUserId, role: "member" },
    meta: { gender: profile.gender },
  });
}

/** Sends a finished profile to the review queue.
 *
 *  Re-checks the blockers server-side. The button only appears when
 *  there are none, but a form that trusts the button that submitted it
 *  is trusting the browser — and here that would let someone reach the
 *  queue without a wali, which is the one promise the whole product is
 *  built around.
 */
export async function submitProfile(): Promise<void> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/onboarding");

  const profile = await findProfileByUserId(session.user.id);
  if (!profile) redirect("/onboarding");

  const blockers = submitBlockers(profile, {
    hasConfirmedWali: await hasConfirmedWali(session.user.id),
  });
  if (blockers.length) redirect("/onboarding");

  /* And the address has to be confirmed. Decided by the client: a
   * profile goes live on its own, with no staff approval in front of it,
   * so the one thing standing between an unreachable stranger and the
   * pool is the link in their inbox. Refused here and not only hidden on
   * the screen — the button is absent, which is not the same as the
   * endpoint being shut. */
  if (!session.user.emailVerifiedAt) redirect("/onboarding");

  await sendProfileIn(session.user.id, profile, session.user.id);

  revalidatePath("/onboarding");
  /* Not back to the checklist. The work is done and the answer to "what
     now" is the account, not the form that fed it. */
  redirect("/dashboard?submitted=1");
}
