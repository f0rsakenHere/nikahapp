import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { fieldsForStep } from "@/lib/domain/profile-form";
import {
  completeness,
  isOptionalStep,
  stepById,
  stepsFor,
  type ProfileDraft,
} from "@/lib/domain/profile";
import { AppFrame } from "../../frame";
import { StepForm } from "./form";
import { GuardianStep } from "./guardian";
import { hasConfirmedWali, listGuardianshipsForMember } from "@/lib/repositories/guardianships";
import { readSettings } from "@/lib/repositories/connections";

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
  /* Counted over the steps that are actually required, so "step 4 of 6"
     cannot sit next to a bar reading 100% — the sixth is the optional
     one, and it is not part of finishing. An optional step has no
     number at all; it is not on the path. */
  const required = visible.filter((s) => !isOptionalStep(s.id, profile.gender));
  const position = required.findIndex((s) => s.id === step.id) + 1;
  const fields = fieldsForStep(step.id, profile.gender);

  /* Only the wali step needs this, and only for a sister, so it is not
     fetched for the other four. */
  const guardianships =
    step.id === "guardian" ? await listGuardianshipsForMember(session.user.id) : [];
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(d);

  const outstanding = guardianships.find((g) => g.status === "invited");
  const active = guardianships.find((g) => g.status === "confirmed");

  const pending = outstanding
    ? {
        name: outstanding.invited.name,
        email: outstanding.invited.email,
        invitedAt: day(outstanding.invited.invitedAt),
        reminders: outstanding.invited.remindersSent,
      }
    : null;

  const confirmed = active
    ? {
        name: active.invited.name,
        email: active.invited.email,
        relationship: active.invited.relationship,
        confirmedAt: active.confirmedAt ? day(active.confirmedAt) : "",
      }
    : null;

  /* A brother may name a wali; he is never required to. The step's own
     blurb promises it gates go-live, which is true of her and not of
     him — so the promise is not made to him. */
  const optional = isOptionalStep(step.id, profile.gender);
  const blurb =
    optional && step.id === "guardian"
      ? "Optional. If you would like someone overseeing your side, name him here."
      : step.blurb;

  /* Framed like the rest of the app, but kept to a reading column: this
     is one form at a time, and a field set stretched across a monitor is
     harder to fill in, not easier. What the desktop gains here is the
     nav and the room around it, not wider inputs. */
  return (
    <AppFrame active="profile" title={step.title}>
      <p className="-mt-3 mb-6 max-w-[560px] text-[18px] leading-[26px] text-text">{blurb}</p>

      {/* Where you are, beside how far along you are — one line, in the
          column it belongs to. It used to sit opposite the title, which
          on a wide pane put it several hundred pixels from anything it
          referred to. */}
      <div className="mb-7 flex max-w-[560px] flex-col gap-2">
        <div className="flex items-center justify-between text-[18px] font-semibold text-text/70">
          <span>{optional ? "Optional step" : `Step ${position} of ${required.length}`}</span>
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

      <div className="max-w-[560px]">
      {step.id === "guardian" ? (
        <GuardianStep
          pending={pending}
          confirmed={confirmed}
          optional={optional}
          moderatorAvailable={Boolean((await readSettings()).moderatorWaliUserId)}
        />
      ) : (
        <StepForm
          step={step.id}
          fields={fields}
          values={valuesOf(profile)}
          /* The last *step in the list*, not the last required one —
             this only decides whether the button says "finish". */
          isLast={visible[visible.length - 1]?.id === step.id}
          draftKey={`onboarding.${step.id}.${session.user.id}`}
        />
      )}
      </div>
    </AppFrame>
  );
}
