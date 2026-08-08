"use client";

import { useActionState } from "react";
import { submitMfaChallenge, type MfaState } from "@/lib/auth/mfa-actions";
import { FormError, SubmitButton } from "@/components/app/form";

const EMPTY: MfaState = {};

export function MfaChallengeForm({ next }: { next?: string }) {
  const [state, action] = useActionState(submitMfaChallenge, EMPTY);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormError>{state.error}</FormError>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
          Six-digit code
        </span>
        <input
          name="code"
          /* `one-time-code` is what lets a phone offer the code from the
             notification, and `numeric` is what gives an older device a
             number pad instead of a full keyboard. */
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoFocus
          className="h-14 w-full rounded-md border border-soft-green bg-white px-3.5 text-center font-mono text-[24px] tracking-[10px] text-black outline-none focus:border-accent-deep"
        />
      </label>

      <SubmitButton>Continue</SubmitButton>
    </form>
  );
}
