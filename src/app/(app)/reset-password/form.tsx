"use client";

import { useActionState } from "react";
import { resetPassword, type AccountState } from "@/lib/auth/account-actions";
import { FormError, SubmitButton, TextField } from "@/components/app/form";

const EMPTY: AccountState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, EMPTY);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormError>{state.error}</FormError>
      <input type="hidden" name="token" value={token} />
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters. A short sentence you will remember is stronger than a short word."
      />
      <SubmitButton>Save the new password</SubmitButton>
    </form>
  );
}
