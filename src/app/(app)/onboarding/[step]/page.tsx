import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { fieldsForStep, valuesOf } from "@/lib/domain/profile-form";
import {
  completeness,
  firstUnfinishedStep,
  isStepUnlocked,
  stepById,
  stepsFor,
  submitBlockers,
} from "@/lib/domain/profile";
import { AppFrame } from "../../frame";
import { StepForm } from "./form";
import { Stepper, type StepperItem } from "./stepper";
import { GuardianStep } from "./guardian";
import { hasConfirmedWali, listGuardianshipsForMember } from "@/lib/repositories/guardianships";
import { MAX_WALIS, activeGuardianships } from "@/lib/domain/guardianship";
import { readSettings } from "@/lib/repositories/connections";

export const metadata: Metadata = { title: "Your profile | NikahCanada" };

export default async function StepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: stepParam } = await params;

  const session = await currentUser();
  if (!session) redirect(`/login?next=/onboarding/${stepParam}`);

  const profile = await findProfileByUserId(session.user.id);
  if (!profile) redirect("/onboarding");

  const step = stepById(stepParam);
  if (!step) notFound();

  const visible = stepsFor(profile.gender);
  /* A brother typing /onboarding/guardian, or a sister /onboarding/
   * reference: send them back rather than showing a 404 for a step that
   * exists and is not theirs. Both of those URLs are reachable — they
   * were in somebody's checklist last week — so this is a real door, not
   * a theoretical one. */
  if (!visible.some((s) => s.id === step.id)) redirect("/onboarding");

  const ctx = { hasConfirmedWali: await hasConfirmedWali(session.user.id) };

  /* One step at a time, in order. Typing the address of a later step —
     or following an old link to it — lands on the first one still
     unfinished, which is where the answers are wanted. */
  if (!isStepUnlocked(profile, step.id, ctx)) {
    const first = firstUnfinishedStep(profile, ctx);
    redirect(first ? `/onboarding/${first.id}` : "/onboarding");
  }

  const progress = completeness(profile, ctx);
  const blockers = submitBlockers(profile, ctx);
  const position = visible.findIndex((s) => s.id === step.id) + 1;
  const fields = fieldsForStep(step.id, profile.gender);

  /* Only the wali step needs this, and only a sister reaches it, so it
     is not fetched for the other four. */
  const guardianships =
    step.id === "guardian" ? await listGuardianshipsForMember(session.user.id) : [];
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(d);

  const outstanding = guardianships.find((g) => g.status === "invited");
  /* All of them. She may name two, and a screen that shows one of her
     two walis is a screen that has quietly lost one. */
  const active = activeGuardianships(guardianships);

  const pending = outstanding
    ? {
        name: outstanding.invited.name,
        email: outstanding.invited.email,
        invitedAt: day(outstanding.invited.invitedAt),
        reminders: outstanding.invited.remindersSent,
      }
    : null;

  const confirmed = active.map((g) => ({
    id: g.id,
    name: g.invited.name,
    email: g.invited.email,
    relationship: g.invited.relationship,
    confirmedAt: g.confirmedAt ? day(g.confirmedAt) : "",
  }));

  /* Where each step stands, for the row across the top. The wali step
     is "done" only once he has confirmed — `required` asks the context —
     and otherwise "open" once she has reached it, never "current" by
     accident of being unfinished. */
  const stepper: StepperItem[] = visible.map((s) => ({
    id: s.id,
    title: s.title,
    state:
      s.id === step.id
        ? "current"
        : !isStepUnlocked(profile, s.id, ctx)
          ? "locked"
          : s.required(profile, ctx)
            ? "done"
            : "open",
  }));

  /* Framed like the rest of the app, but kept to a reading column: this
     is one form at a time, and a field set stretched across a monitor is
     harder to fill in, not easier. What the desktop gains here is the
     nav and the room around it, not wider inputs. */
  return (
    <AppFrame active="profile" title={step.title}>
      <p className="-mt-3 mb-6 max-w-[560px] text-[18px] leading-[26px] text-text">{step.blurb}</p>

      {/* Where you are, how far along, and what is still ahead and shut.
          The bar tracks completion, not position. Filling it by position
          put a 60%-wide bar next to the words "20% complete", which is
          the sort of thing a reader notices immediately and an automated
          check never does. */}
      <div className="mb-7 flex max-w-[560px] flex-col gap-3">
        <div className="flex items-center justify-between gap-3 text-[18px] font-semibold text-text/70">
          <span>
            {`Step ${position} of ${visible.length}`}
            <span className="font-normal text-text/60"> · {step.title}</span>
          </span>
          <span className="shrink-0 text-peach-deep">{progress.percent}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-soft-green">
          <div
            className="h-full rounded-full bg-peach"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <Stepper items={stepper} />
      </div>

      {step.id !== "guardian" ? (
        <p className="mb-6 max-w-[560px] text-[18px] leading-[26px] text-text/70">
          Questions marked <span className="text-peach-deep">*</span> need an answer before the
          next step opens. Everything you fill in is saved.
        </p>
      ) : null}

      <div className="max-w-[560px]">
      {step.id === "guardian" ? (
        <GuardianStep
          pending={pending}
          confirmed={confirmed}
          maxWalis={MAX_WALIS}
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
          /* The last thing anybody is waiting on. Saying "save and
             continue" on the answer that finishes the profile is what
             sent a tester hunting for a send button. */
          completesProfile={
            profile.status === "draft" &&
            Boolean(session.user.emailVerifiedAt) &&
            blockers.length > 0 &&
            blockers.every((b) => b.step === step.id)
          }
          draftKey={`onboarding.${step.id}.${session.user.id}`}
        />
      )}
      </div>
    </AppFrame>
  );
}
