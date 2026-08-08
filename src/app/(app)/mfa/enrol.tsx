"use client";

import { useActionState, useEffect, useState } from "react";
import {
  beginMfaEnrolment,
  confirmMfaEnrolment,
  type MfaState,
} from "@/lib/auth/mfa-actions";
import { FormError, SubmitButton } from "@/components/app/form";

const EMPTY: MfaState = {};

/** Enrolment during a half-authenticated sign-in.
 *
 *  The secret is minted on arrival rather than behind a button: they are
 *  here because they cannot get in without it, so there is nothing to
 *  opt into. */
export function MfaEnrolAtSignIn({ next }: { next?: string }) {
  const [setup, setSetup] = useState<MfaState | null>(null);
  const [state, action] = useActionState(confirmMfaEnrolment, EMPTY);

  useEffect(() => {
    let live = true;
    beginMfaEnrolment().then((s) => {
      if (live) setSetup(s);
    });
    return () => {
      live = false;
    };
  }, []);

  const active = state.secret ? state : setup;

  if (!active?.secret) {
    return <p className="text-[13px] text-text">Preparing…</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormError>{active.error}</FormError>
      <input type="hidden" name="secret" value={active.secret} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <code className="select-all break-all rounded-md border border-soft-green bg-mist px-3.5 py-3 font-mono text-[13px] tracking-[1px] text-black">
        {active.secret}
      </code>

      <a
        href={active.uri}
        className="text-[13px] font-semibold text-peach-deep underline-offset-2 hover:underline"
      >
        Or open it in your authenticator app
      </a>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
          The six digits it shows
        </span>
        <input
          name="code"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          className="h-14 w-full rounded-md border border-soft-green bg-white px-3.5 text-center font-mono text-[24px] tracking-[10px] text-black outline-none focus:border-accent-deep"
        />
      </label>

      <SubmitButton>Finish signing in</SubmitButton>
    </form>
  );
}
