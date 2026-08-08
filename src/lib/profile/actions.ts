"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current";
import { parseStepForm } from "@/lib/domain/profile-form";
import { stepsFor, type StepId } from "@/lib/domain/profile";
import { findProfileByUserId, saveProfileSection } from "@/lib/repositories/profiles";

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
