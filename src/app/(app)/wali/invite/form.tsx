"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  acceptInvitation,
  declineInvitation,
  type WaliState,
} from "@/lib/guardianship/actions";
import { FormError, SubmitButton, TextField } from "@/components/app/form";

const EMPTY: WaliState = {};

const POWERS = [
  "You will see every introduction she receives, the moment she does.",
  "You will be able to read every message she exchanges.",
  "No conversation opens until you approve it.",
  "You can end a conversation at any point.",
];

export function InvitationForm({
  token,
  waliName,
  hasAccount,
}: {
  token: string;
  waliName: string;
  hasAccount: boolean;
}) {
  const [accept, acceptAction] = useActionState(acceptInvitation, EMPTY);
  const [decline, declineAction] = useActionState(declineInvitation, EMPTY);
  const [declining, setDeclining] = useState(false);

  if (decline.done === "declined") {
    return (
      <p className="rounded-md border border-soft-green bg-mist px-4 py-4 text-[14px] leading-[22px] text-black">
        You have declined. We have let her know, and you will hear nothing further from us
        about this.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {/* He arrives cold. This email is very likely the first he has
          heard of us, and asking a man to vouch for a relative before
          telling him who is asking is how the message gets deleted. */}
      <p className="text-[13px] leading-[20px] text-text">
        NikahCanada is a Muslim marriage and matrimony service, based in Montreal and operating
        across Canada. A wali is required for every woman who registers, from the beginning of
        the process rather than the end of it.
      </p>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
          What this asks of you
        </p>
        <ul className="mt-3 flex flex-col gap-2.5">
          {POWERS.map((p) => (
            <li key={p} className="flex gap-2.5 text-[13px] leading-[19px] text-black/80">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-peach" />
              {p}
            </li>
          ))}
        </ul>
      </div>

      {declining ? (
        <form action={declineAction} className="flex flex-col gap-4 border-t border-soft-green pt-6">
          <input type="hidden" name="token" value={token} />
          <FormError>{decline.error}</FormError>
          <TextField
            label="Anything you want us to pass on?"
            name="reason"
            placeholder="Optional"
          />
          <button
            type="submit"
            className="h-12 w-full rounded-pill border-2 border-soft-green text-[14px] font-semibold text-text"
          >
            Confirm that you are declining
          </button>
          <button
            type="button"
            onClick={() => setDeclining(false)}
            className="text-[13px] text-text underline-offset-2 hover:underline"
          >
            Go back
          </button>
        </form>
      ) : (
        <form action={acceptAction} className="flex flex-col gap-5 border-t border-soft-green pt-6">
          <input type="hidden" name="token" value={token} />

          {accept.error === "sign-in-required" ? (
            <div className="rounded-md border border-peach/40 bg-soft-peach/60 px-3.5 py-3">
              <p className="text-[13px] leading-[19px] text-text">
                You already have a NikahCanada account on this address. Sign in first, then open
                this link again — we will not ask you for a new password.
              </p>
              <Link
                href="/login"
                className="mt-2 inline-block text-[13px] font-semibold text-peach-deep underline-offset-2 hover:underline"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <FormError>{accept.error}</FormError>
          )}

          {hasAccount ? (
            <p className="text-[13px] leading-[19px] text-text">
              Signed in as {waliName}? Confirming will add her to your account.
            </p>
          ) : (
            <TextField
              label="Choose a password"
              name="password"
              type="password"
              autoComplete="new-password"
              hint="At least 10 characters. This is how you will sign in to read her conversations."
            />
          )}

          <SubmitButton>I accept, and will act as her wali</SubmitButton>

          <button
            type="button"
            onClick={() => setDeclining(true)}
            className="text-center text-[13px] text-text underline-offset-2 hover:underline"
          >
            I cannot do this
          </button>
        </form>
      )}
    </div>
  );
}
