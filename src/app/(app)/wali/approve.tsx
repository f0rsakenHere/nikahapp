"use client";

import { useActionState, useState } from "react";
import { decideAsWali, type ThreadState } from "@/lib/conversations/actions";
import { FormError, SubmitButton } from "@/components/app/form";

const EMPTY: ThreadState = {};

export function ApproveForm({ conversationId }: { conversationId: string }) {
  const [state, action] = useActionState(decideAsWali.bind(null, conversationId), EMPTY);
  const [declining, setDeclining] = useState(false);

  if (declining) {
    return (
      <form action={action} className="mt-3 flex flex-col gap-2">
        <FormError>{state.error}</FormError>
        <input type="hidden" name="decision" value="decline" />
        <input
          name="reason"
          placeholder="Anything you want recorded (optional)"
          className="h-11 w-full rounded-md border border-soft-green bg-white px-3 text-[18px] text-black outline-none focus:border-accent-deep"
        />
        <p className="text-[18px] leading-[26px] text-text">
          The conversation will not open. She is told you decided, and he is told only that it is
          closed.
        </p>
        <SubmitButton>Confirm that you are declining</SubmitButton>
        <button
          type="button"
          onClick={() => setDeclining(false)}
          className="text-[18px] text-text underline-offset-2 hover:underline"
        >
          Go back
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      <FormError>{state.error}</FormError>
      <input type="hidden" name="decision" value="approve" />
      <button type="submit" className="h-11 w-full rounded-pill bg-peach text-[18px] font-semibold text-black">
        Approve, and read what they say
      </button>
      <button
        type="button"
        onClick={() => setDeclining(true)}
        className="h-11 w-full rounded-pill border-2 border-soft-green text-[18px] font-semibold text-text"
      >
        Decline
      </button>
    </form>
  );
}
