"use client";

/* "We sent you a link" — said on the screen, not only in the inbox.
 *
 * Registration sends a confirmation email and then puts the member on
 * their profile checklist, which until now said nothing about it. Anyone
 * whose email was slow, or filed as spam, was left on a page with no
 * mention of the thing waiting for them — and a link nobody is expecting
 * is a link nobody opens.
 *
 * Deliberately not a blocker. Nothing in the product is gated on a
 * confirmed address today, so this states what happened and offers the
 * link again; it does not pretend the profile cannot go on without it.
 */

import { useActionState } from "react";
import {
  requestEmailVerification,
  type AccountState,
} from "@/lib/auth/account-actions";
import { DevLink } from "@/components/app/form";

const EMPTY: AccountState = {};

export function ConfirmEmail({ email }: { email: string }) {
  const [state, action] = useActionState(
    async (_p: AccountState) => requestEmailVerification(),
    EMPTY
  );

  return (
    <div className="mb-6 rounded-md border border-peach bg-soft-peach/40 px-4 py-4">
      <p className="text-[18px] font-semibold text-black">Confirm your email address</p>
      <p className="mt-2 text-[18px] leading-[26px] text-text">
        We have sent a link to{" "}
        <span className="font-semibold break-all text-black">{email}</span>. Open it to confirm
        the address is yours, so we can reach you and you can get back in if you forget your
        password. It can take a minute to arrive, and it is worth a look in your spam folder.
      </p>
      <form action={action} className="mt-3 flex flex-col gap-2">
        {state.done ? <p className="text-[18px] text-accent-deep">{state.done}</p> : null}
        <DevLink href={state.devLink} />
        <button
          type="submit"
          className="h-12 w-full rounded-pill border-2 border-accent-deep text-[18px] font-semibold text-accent-deep sm:w-auto sm:px-6"
        >
          Send the link again
        </button>
      </form>
    </div>
  );
}
