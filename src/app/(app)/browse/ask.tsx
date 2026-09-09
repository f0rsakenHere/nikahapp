"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendConnection, type ConnectState } from "@/lib/connections/actions";
import { CheckIcon } from "@/components/app/icons";

const EMPTY: ConnectState = {};

/* Asking without opening the profile first.
 *
 * The same server action the profile page uses — not a second path.
 * Every rule that matters (the balance, the recipient's inbound cap, a
 * request already between the pair, her wali) is enforced there, so this
 * cannot become the lenient door. What differs is only the room it has
 * to say things in: a refusal here is one line under the button rather
 * than a panel.
 *
 * It stays a form so it works before hydration and without JavaScript —
 * a browse page of dead buttons is worse than no buttons.
 */

function Pending() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      /* No icon, and it does not wrap. Four cards to a row leaves this
         about 230px, and the old label — "Ask · 1 connection" — plus a
         glyph needed more than that. The price is gone from the label
         because there is no longer a price: asking is free, and what a
         plan buys is the conversation that follows. */
      className="pointer-events-auto flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-pill border-2 border-accent-deep px-3.5 py-2 text-[18px] font-semibold text-accent-deep transition-colors hover:bg-accent/15 disabled:opacity-60"
    >
      {pending ? "Sending…" : "Ask to talk"}
    </button>
  );
}

export function AskButton({
  profileId,
  alreadyAsked,
}: {
  profileId: string;
  alreadyAsked: boolean;
}) {
  const [state, action] = useActionState(sendConnection.bind(null, profileId), EMPTY);

  if (state.done || alreadyAsked) {
    return (
      <p className="pointer-events-auto flex items-center justify-center gap-2 rounded-pill bg-mist px-4 py-2 text-[18px] font-semibold text-accent-deep">
        <CheckIcon className="text-[19px]" />
        Asked
      </p>
    );
  }

  return (
    <form action={action}>
      <Pending />
      {state.error ? (
        <p role="alert" className="pointer-events-auto mt-2 text-[18px] leading-[26px] text-peach-deep">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
