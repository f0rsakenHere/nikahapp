"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { saveStep, type StepState } from "@/lib/profile/actions";
import type { FieldSpec } from "@/lib/domain/profile-form";
import type { StepId } from "@/lib/domain/profile";
import { FormDraft } from "@/components/app/draft";
import { FormError, SpecField, SubmitButton } from "@/components/app/form";

const EMPTY: StepState = {};

export function StepForm({
  step,
  fields,
  values,
  isLast,
  completesProfile,
  draftKey,
}: {
  step: StepId;
  fields: FieldSpec[];
  /** Current answers, keyed by the same `section.key` path. */
  values: Record<string, unknown>;
  isLast: boolean;
  /** True when answering this step finishes the profile, in which case
   *  saving it also sends it in. */
  completesProfile?: boolean;
  /** Scoped to this member, so a shared browser never restores one
   *  person's answers into another person's profile. */
  draftKey: string;
}) {
  const action = saveStep.bind(null, step);
  const [state, formAction] = useActionState(action, EMPTY);
  const formRef = useRef<HTMLFormElement>(null);

  /* The button is at the bottom and the first unanswered question may be
     a screen and a half above it. Without this, pressing it on a phone
     looked like nothing happening at all. Deferred a tick so it runs
     after React's reset and the draft's restore. */
  useEffect(() => {
    const first = state.missing?.[0];
    if (!first || !formRef.current) return;
    const el = formRef.current.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`);
    if (!el) return;
    /* Scrolled to, not focused. Focus paints the green "you are here"
       border over the red one, so the first missing question was the
       one that did not look missing. The summary is a live alert, which
       is what tells a screen reader. */
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-7" noValidate>
      {/* Saved answers come from the server; this covers the ones typed
          since, which until now a refresh threw away. */}
      <FormDraft name={draftKey} />

      <FormError>
        {state.missing?.length
          ? state.missing.length === 1
            ? "Please answer the highlighted question to continue."
            : `Please answer the ${state.missing.length} highlighted questions to continue.`
          : state.issues?.[0]}
      </FormError>

      {fields.map((spec) => (
        <SpecField
          key={spec.path}
          spec={spec}
          value={values[spec.path]}
          /* Marked where it is, not only in the summary at the top: on a
             phone the summary has scrolled away by the time somebody
             reaches the box it means. */
          error={state.missing?.includes(spec.path) ? "Please answer this to continue." : undefined}
        />
      ))}

      <div className="flex flex-col gap-3 border-t border-soft-green pt-6">
        <SubmitButton>
          {completesProfile
            ? "Save and send my profile"
            : isLast
              ? "Save and finish"
              : "Save and continue"}
        </SubmitButton>
        {/* Leaving is a normal thing to do here, not an escape hatch —
            everything filled in is already saved by the button above,
            and this link says so rather than implying loss. */}
        <Link
          href="/onboarding"
          className="text-center text-[18px] text-text underline-offset-2 hover:underline"
        >
          Back to your progress
        </Link>
      </div>
    </form>
  );
}
