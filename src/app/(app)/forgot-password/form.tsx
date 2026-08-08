"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AccountState } from "@/lib/auth/account-actions";
import { DevLink, SubmitButton, TextField } from "@/components/app/form";

const EMPTY: AccountState = {};

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, EMPTY);

  /* The same answer whether or not the address has an account. Telling
     someone "no account for that address" would confirm that a
     particular person is or is not looking for a spouse. */
  if (state.done) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md border border-soft-green bg-mist px-4 py-4 text-[14px] leading-[22px] text-black">
          {state.done}
        </p>
        <DevLink href={state.devLink} />
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <TextField label="Email" name="email" type="email" autoComplete="email" />
      <SubmitButton>Send the link</SubmitButton>
    </form>
  );
}
