import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { fieldsForStep } from "@/lib/domain/profile-form";
import { completeness, stepById, stepsFor, type ProfileDraft } from "@/lib/domain/profile";
import { AuthShell } from "../../auth-shell";
import { StepForm } from "./form";
import { GuardianStep } from "./guardian";
import { hasConfirmedWali, listGuardianshipsForMember } from "@/lib/repositories/guardianships";

export const metadata: Metadata = { title: "Your profile — NikahCanada" };

/** Flattens the draft to the `section.key` paths the specs use. */
function valuesOf(profile: ProfileDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [section, values] of Object.entries(profile)) {
    if (!values || typeof values !== "object" || Array.isArray(values) || values instanceof Date) {
      continue;
    }
    for (const [key, value] of Object.entries(values)) out[`${section}.${key}`] = value;
  }
  return out;
}

export default async function StepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: stepParam } = await params;

  const session = await currentUser();
  if (!session) redirect(`/login?next=/onboarding/${stepParam}`);

  const profile = await findProfileByUserId(session.user.id);
  if (!profile) redirect("/onboarding");

  const step = stepById(stepParam);
  if (!step) notFound();

  const visible = stepsFor(profile.gender);
  /* A brother reaching /onboarding/guardian by typing it: send him back
   * rather than showing a 404 for a step that exists but is not his. */
  if (!visible.some((s) => s.id === step.id)) redirect("/onboarding");

  const progress = completeness(profile, {
    hasConfirmedWali: await hasConfirmedWali(session.user.id),
  });
  const position = visible.findIndex((s) => s.id === step.id) + 1;
  const fields = fieldsForStep(step.id, profile.gender);

  /* Only the wali step needs this, and only for a sister, so it is not
     fetched for the other four. */
  const outstanding =
    step.id === "guardian"
      ? (await listGuardianshipsForMember(session.user.id)).find((g) => g.status === "invited")
      : undefined;
  const pending = outstanding
    ? {
        name: outstanding.invited.name,
        email: outstanding.invited.email,
        invitedAt: new Intl.DateTimeFormat("en-CA", {
          dateStyle: "medium",
          timeZone: "UTC",
        }).format(outstanding.invited.invitedAt),
      }
    : null;

  return (
    <AuthShell title={step.title} blurb={step.blurb}>
      <div className="mb-7 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[1px] text-text/70">
          <span>
            Step {position} of {visible.length}
          </span>
          <span className="text-peach-deep">{progress.percent}% complete</span>
        </div>
        {/* The bar tracks completion, not position. Filling it by
            position put a 60%-wide bar next to the words "20% complete",
            which is the sort of thing a reader notices immediately and
            an automated check never does. */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-soft-green">
          <div
            className="h-full rounded-full bg-peach"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {step.id === "guardian" ? (
        <GuardianStep pending={pending} />
      ) : (
        <StepForm
          step={step.id}
          fields={fields}
          values={valuesOf(profile)}
          isLast={position === visible.length}
        />
      )}
    </AuthShell>
  );
}
