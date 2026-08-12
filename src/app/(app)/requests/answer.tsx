"use client";

import { useActionState, useState } from "react";
import { answerConnection, type ConnectState } from "@/lib/connections/actions";
import { FormError } from "@/components/app/form";
import { CheckIcon, ChatIcon } from "@/components/app/icons";

const EMPTY: ConnectState = {};

/* Sized to the words in it.
 *
 * These were `flex-1`, which on a phone gave two halves of a card and on
 * a monitor gave two five-hundred-pixel slabs — the same markup reading
 * as a sensible pair of buttons at one width and as a landing page at
 * another. A button's job is to be found and pressed, and past a certain
 * size more pixels stop helping and start shouting. */
const BTN =
  "flex h-11 items-center justify-center gap-2 rounded-pill px-5 text-[18px] font-semibold transition-colors";

export function AnswerForm({ requestId, side }: { requestId: string; side: "in" | "out" }) {
  const [state, action] = useActionState(answerConnection.bind(null, requestId), EMPTY);
  const [declining, setDeclining] = useState(false);

  if (state.done) {
    return (
      <p className="flex w-full items-start gap-2.5 rounded-lg bg-mist px-3.5 py-3 text-[18px] leading-[26px] text-text">
        <CheckIcon className="mt-1 shrink-0 text-[19px] text-accent-deep" />
        {state.done === "accepted"
          ? "Accepted. The conversation opens once the wali approves."
          : state.done === "withdrawn"
            ? "Withdrawn. Your connection has been returned."
            : "Answered. They are told only that it is closed."}
      </p>
    );
  }

  if (side === "out") {
    return (
      /* A bordered control, not a sentence pretending to be one. It was
         set as plain underlined text, which on a card of plain text is
         indistinguishable from the card. */
      <form action={action} className="flex shrink-0 flex-col items-end gap-2">
        <FormError>{state.error}</FormError>
        <input type="hidden" name="answer" value="withdraw" />
        <button
          type="submit"
          className="h-11 rounded-pill border-2 border-soft-green px-5 text-[18px] font-semibold text-text transition-colors hover:border-peach-deep hover:text-peach-deep"
        >
          Withdraw
        </button>
      </form>
    );
  }

  if (declining) {
    return (
      /* Full width while it is asking a question, because the box it is
         asking into needs the room. */
      <form action={action} className="flex w-full flex-col gap-2">
        <FormError>{state.error}</FormError>
        <input type="hidden" name="answer" value="decline" />
        <input
          name="reason"
          placeholder="Anything you want us to know (optional, never shown to them)"
          className="h-11 w-full rounded-md border border-soft-green bg-white px-3 text-[18px] text-black outline-none focus:border-accent-deep"
        />
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setDeclining(false)}
            className={`${BTN} border-2 border-accent-deep text-accent-deep`}
          >
            Go back
          </button>
          <button type="submit" className={`${BTN} bg-soft-peach text-peach-deep hover:opacity-90`}>
            Confirm
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="flex shrink-0 flex-col items-end gap-2">
      <FormError>{state.error}</FormError>
      {/* A hidden input rather than the submit button's name and value.
          The button carries one answer and the form carries the other,
          which makes the answer depend on which control submitted —
          fine in a browser, and one more thing to be wrong. This way the
          form says what it means, and works without JavaScript. */}
      <input type="hidden" name="answer" value="accept" />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* The gentler answer first, in the reading order of a decision:
            you are not being asked to accept, you are being asked to
            choose. The accepting one carries the colour. */}
        <button
          type="button"
          onClick={() => setDeclining(true)}
          className={`${BTN} border-2 border-soft-green text-text hover:border-text/40`}
        >
          Not for me
        </button>
        <button type="submit" className={`${BTN} bg-peach text-black hover:opacity-90`}>
          <ChatIcon className="text-[19px]" />
          Accept
        </button>
      </div>
      {/* Blocking is a different act from declining and is not offered
          beside it: putting them side by side makes "block" the reflex
          for an ordinary no, which then makes the safety queue useless
          for what it is actually for. */}
    </form>
  );
}
