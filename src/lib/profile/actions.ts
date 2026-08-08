"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current";
import { parseStepForm } from "@/lib/domain/profile-form";
import { stepsFor, submitBlockers, type StepId } from "@/lib/domain/profile";
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

  const patch = parseStepForm(step, profile.gender, form);
  const saved = await saveProfileSection(session.user.id, patch, new Date());

  if (!saved.ok) return { issues: saved.issues };

  revalidatePath("/onboarding");

  /* Forward to the next step this member actually sees — a brother is
   * never shown the wali step, so "the next one" is not step n + 1. */
  const steps = stepsFor(profile.gender);
  const here = steps.findIndex((s) => s.id === step);
  const next = steps[here + 1];
  redirect(next ? `/onboarding/${next.id}` : "/onboarding");
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

  const now = new Date();
  await submitForReview(session.user.id, now);

  /* The checks staff will work from, opened at submission rather than
   * when someone first opens the case. A queue that only fills when a
   * reviewer looks at it is a queue that hides its own backlog. */
  await openRequiredChecks(
    session.user.id,
    profile.gender,
    { reference: profile.gender === "brother" ? profile.reference : undefined },
    now
  );

  await record({
    action: "profile.submitted",
    subject: { type: "profile", id: profile.id },
    actor: { userId: session.user.id, role: "member" },
    meta: { gender: profile.gender },
  });

  revalidatePath("/onboarding");
  redirect("/onboarding?submitted=1");
}
