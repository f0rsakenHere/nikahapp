"use client";

import { useActionState, useState } from "react";
import { answerConnection, type ConnectState } from "@/lib/connections/actions";
import { FormError } from "@/components/app/form";

const EMPTY: ConnectState = {};

const BTN = "h-10 flex-1 rounded-pill text-[13px] font-semibold";

export function AnswerForm({ requestId, side }: { requestId: string; side: "in" | "out" }) {
  const [state, action] = useActionState(answerConnection.bind(null, requestId), EMPTY);
  const [declining, setDeclining] = useState(false);

  if (state.done) {
    return (
      <p className="mt-3 text-[13px] text-text">
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
      <form action={action} className="mt-3">
        <FormError>{state.error}</FormError>
        <input type="hidden" name="answer" value="withdraw" />
        <button type="submit" className="text-[13px] text-text underline-offset-2 hover:underline">
          Withdraw this request
        </button>
      </form>
    );
  }

  if (declining) {
    return (
      <form action={action} className="mt-3 flex flex-col gap-2">
        <FormError>{state.error}</FormError>
        <input type="hidden" name="answer" value="decline" />
        <input
          name="reason"
          placeholder="Anything you want us to know (optional, never shown to them)"
          className="h-11 w-full rounded-md border border-soft-green bg-white px-3 text-[13px] text-black outline-none focus:border-accent-deep"
        />
        <div className="flex gap-2">
          <button type="submit" className={`${BTN} border-2 border-soft-green text-peach-deep`}>
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setDeclining(false)}
            className={`${BTN} border-2 border-accent-deep text-accent-deep`}
          >
            Go back
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      <FormError>{state.error}</FormError>
      {/* A hidden input rather than the submit button's name and value.
          The button carries one answer and the form carries the other,
          which makes the answer depend on which control submitted —
          fine in a browser, and one more thing to be wrong. This way the
          form says what it means, and works without JavaScript. */}
      <input type="hidden" name="answer" value="accept" />
      <div className="flex gap-2">
        <button type="submit" className={`${BTN} bg-peach text-black`}>
          Accept
        </button>
        <button
          type="button"
          onClick={() => setDeclining(true)}
          className={`${BTN} border-2 border-soft-green text-text`}
        >
          Not for me
        </button>
      </div>
      {/* Blocking is a different act from declining and is not offered
          beside it: putting them side by side makes "block" the reflex
          for an ordinary no, which then makes the safety queue useless
          for what it is actually for. */}
    </form>
  );
}
