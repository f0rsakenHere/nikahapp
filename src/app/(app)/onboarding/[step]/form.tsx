"use client";

import Link from "next/link";
import { useActionState } from "react";
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
  draftKey,
}: {
  step: StepId;
  fields: FieldSpec[];
  /** Current answers, keyed by the same `section.key` path. */
  values: Record<string, unknown>;
  isLast: boolean;
  /** Scoped to this member, so a shared browser never restores one
   *  person's answers into another person's profile. */
  draftKey: string;
}) {
  const action = saveStep.bind(null, step);
  const [state, formAction] = useActionState(action, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-7" noValidate>
      {/* Saved answers come from the server; this covers the ones typed
          since, which until now a refresh threw away. */}
      <FormDraft name={draftKey} />

      <FormError>{state.issues?.[0]}</FormError>

      {fields.map((spec) => (
        <SpecField key={spec.path} spec={spec} value={values[spec.path]} />
      ))}

      <div className="flex flex-col gap-3 border-t border-soft-green pt-6">
        <SubmitButton>{isLast ? "Save and finish" : "Save and continue"}</SubmitButton>
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
