"use client";

import { useActionState, useState } from "react";
import {
  beginMfaEnrolment,
  confirmMfaEnrolment,
  type MfaState,
} from "@/lib/auth/mfa-actions";
import { FormError, SubmitButton } from "@/components/app/form";

const EMPTY: MfaState = {};

const GHOST =
  "h-12 w-full rounded-pill border-2 border-accent-deep text-[18px] font-semibold text-accent-deep";

export function MfaSection({ enabled, required }: { enabled: boolean; required: boolean }) {
  const [setup, setSetup] = useState<MfaState | null>(null);
  const [state, action] = useActionState(confirmMfaEnrolment, EMPTY);
  const [pending, setPending] = useState(false);

  if (enabled) {
    return (
      <p className="text-[18px] text-accent-deep">
        On. You are asked for a code from your authenticator app each time you sign in.
      </p>
    );
  }

  const active = state.secret ? state : setup;

  if (!active?.secret) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[18px] leading-[26px] text-text">
          {required
            ? "Required for this account. You read other people's private correspondence, so a password on its own is not enough."
            : "Optional, and worth turning on. It means a stolen password is not enough to reach your account."}
        </p>
        <button
          type="button"
          disabled={pending}
          className={GHOST}
          onClick={async () => {
            setPending(true);
            setSetup(await beginMfaEnrolment());
            setPending(false);
          }}
        >
          {pending ? "One moment…" : "Set up two-factor"}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormError>{active.error}</FormError>
      <input type="hidden" name="secret" value={active.secret} />

      <p className="text-[18px] leading-[26px] text-text">
        Add this to your authenticator app, then type the code it gives you.
      </p>

      {/* The secret as text rather than a QR code. A QR needs a rendering
          dependency, and this is a staff screen used once per account —
          every authenticator app accepts manual entry. Worth replacing
          with a QR before non-technical staff are onboarded. */}
      <code className="select-all break-all rounded-md border border-soft-green bg-mist px-3.5 py-3 font-mono text-[18px] tracking-[1px] text-black">
        {active.secret}
      </code>

      <a
        href={active.uri}
        className="text-[18px] font-semibold text-peach-deep underline-offset-2 hover:underline"
      >
        Or open it in your authenticator app
      </a>

      <label className="flex flex-col gap-1.5">
        <span className="text-[18px] font-semibold uppercase tracking-[0.6px] text-text/70">
          The six digits it shows
        </span>
        <input
          name="code"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
          className="h-14 w-full rounded-md border border-soft-green bg-white px-3.5 text-center font-mono text-[24px] tracking-[10px] text-black outline-none focus:border-accent-deep"
        />
      </label>

      <SubmitButton>Turn on two-factor</SubmitButton>
    </form>
  );
}
