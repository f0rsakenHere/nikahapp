"use client";

import { useActionState } from "react";
import {
  changePassword,
  requestEmailVerification,
  revokeSession,
  signOutEverywhereElse,
  type AccountState,
} from "@/lib/auth/account-actions";
import { DevLink, FormError, SubmitButton, TextField } from "@/components/app/form";

const EMPTY: AccountState = {};

const GHOST =
  "h-12 w-full rounded-pill border-2 border-accent-deep text-[14px] font-semibold text-accent-deep";

export function SendVerification() {
  const [state, action] = useActionState(
    async (_p: AccountState) => requestEmailVerification(),
    EMPTY
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      {state.done ? <p className="text-[12px] text-accent-deep">{state.done}</p> : null}
      <DevLink href={state.devLink} />
      <button type="submit" className={GHOST}>
        Send me a confirmation link
      </button>
    </form>
  );
}

export function ChangePassword() {
  const [state, action] = useActionState(changePassword, EMPTY);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormError>{state.error}</FormError>
      <TextField
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
      />
      <TextField
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters."
      />
      <SubmitButton>Change password</SubmitButton>
    </form>
  );
}

export function SignOutEverywhere() {
  const [, action] = useActionState(async (_p: AccountState) => signOutEverywhereElse(), EMPTY);
  return (
    <form action={action} className="mt-2">
      <button type="submit" className={GHOST}>
        Sign out on every device
      </button>
    </form>
  );
}

export function SessionRow({
  tokenHash,
  isCurrent,
  device,
  lastSeen,
}: {
  tokenHash: string;
  isCurrent: boolean;
  device: string;
  lastSeen: string;
}) {
  const action = revokeSession.bind(null, tokenHash);
  return (
    <li className="flex items-center gap-3 rounded-md border border-soft-green px-3.5 py-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold text-black">
          {device}
          {isCurrent ? <span className="ml-2 font-normal text-accent-deep">this device</span> : null}
        </span>
        <span className="text-[11px] text-text/70">Last used {lastSeen}</span>
      </span>
      {isCurrent ? null : (
        <form action={action}>
          <button
            type="submit"
            className="rounded-pill border border-soft-green px-3 py-1.5 text-[11px] font-semibold text-peach-deep"
          >
            Sign out
          </button>
        </form>
      )}
    </li>
  );
}
