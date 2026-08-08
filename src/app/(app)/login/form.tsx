"use client";

import { useActionState } from "react";
import { login, type FormState } from "@/lib/auth/actions";
import { FormError, SubmitButton, TextField } from "@/components/app/form";

const EMPTY: FormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, EMPTY);
  const v = state.values ?? {};
  const e = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {/* Where the middleware was sending them before it found no
          session. Re-validated server-side in `safeNext` — a hidden
          input is caller-supplied data like any other. */}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {/* One message for every failure, and it never says which half was
          wrong. Confirming that an address has an account here is a
          disclosure about a person's marital intentions. */}
      <FormError>{e._form}</FormError>

      <TextField
        label="Email"
        name="email"
        type="email"
        defaultValue={v.email}
        autoComplete="email"
      />

      <TextField label="Password" name="password" type="password" autoComplete="current-password" />

      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
