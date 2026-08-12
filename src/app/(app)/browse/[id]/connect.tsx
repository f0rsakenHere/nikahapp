"use client";

import { useActionState } from "react";
import { sendConnection, type ConnectState } from "@/lib/connections/actions";
import { FormError, SubmitButton } from "@/components/app/form";

const EMPTY: ConnectState = {};

/* Coarse on purpose.
 *
 * The exact state was being passed in — "declined", "expired",
 * "withdrawn" — and a client component's props travel to the browser in
 * the payload whether or not they are rendered. With `discloseDecline`
 * set to false, shipping her actual answer to him and then choosing not
 * to print it is not privacy, it is obscurity. He gets "closed". */
export type ConnectionView = "none" | "open" | "accepted" | "closed";

export function ConnectButton({
  profileId,
  existing,
  balance,
  charge,
}: {
  profileId: string;
  existing: ConnectionView;
  balance: number;
  charge: "onSend" | "onAccept" | "reserve";
}) {
  const [state, action] = useActionState(sendConnection.bind(null, profileId), EMPTY);

  if (state.done || existing === "open") {
    return (
      <p className="rounded-md border border-soft-green bg-mist px-4 py-4 text-[18px] leading-[26px] text-black">
        Your request is with them. You will hear when they answer — and nothing is shared until
        they do.
      </p>
    );
  }

  if (existing === "accepted") {
    return (
      <p className="rounded-md border border-soft-green bg-mist px-4 py-4 text-[18px] leading-[26px] text-black">
        They accepted. The conversation opens once the wali approves.
      </p>
    );
  }

  if (existing === "closed") {
    /* Declined, expired, withdrawn, blocked. Deliberately one sentence
       for all of them: telling someone which is a disclosure about the
       other person's decision, and "no longer available" is both kinder
       and safer than "she said no". */
    return (
      <p className="rounded-md border border-soft-green bg-mist px-4 py-4 text-[18px] leading-[26px] text-text">
        This one is closed. We do not pass on a second request.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <FormError>{state.error}</FormError>

      <SubmitButton>
        {charge === "onAccept" ? "Ask to talk" : "Ask to talk · uses 1 connection"}
      </SubmitButton>

      <p className="text-center text-[18px] leading-[26px] text-text/70">
        {charge === "reserve"
          ? `You have ${balance}. It is held while they decide, and returned if they decline or do not answer.`
          : `You have ${balance}.`}
      </p>
    </form>
  );
}
