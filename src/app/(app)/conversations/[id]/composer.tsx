"use client";

import { useActionState, useRef, useState } from "react";
import { closeConversation, sendMessage, type ThreadState } from "@/lib/conversations/actions";
import { FormError, SubmitButton } from "@/components/app/form";

const EMPTY: ThreadState = {};

export function Composer({ conversationId }: { conversationId: string }) {
  const [state, action] = useActionState(sendMessage.bind(null, conversationId), EMPTY);
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      action={async (data) => {
        await action(data);
        form.current?.reset();
      }}
      className="mt-6 flex flex-col gap-2"
    >
      <FormError>{state.error}</FormError>
      <textarea
        name="body"
        rows={3}
        maxLength={4000}
        placeholder="Write a message"
        className="w-full rounded-md border border-soft-green bg-white px-3.5 py-2.5 text-[18px] leading-[26px] text-black outline-none focus:border-accent-deep"
      />
      {/* Said next to the button rather than in a policy. It is the one
          thing about this product that people most need to have
          understood before they press send. */}
      <p className="text-[18px] leading-[26px] text-text/70">
        Messages cannot be edited or deleted once sent, by anyone.
      </p>
      <SubmitButton>Send</SubmitButton>
    </form>
  );
}

export function CloseThread({
  conversationId,
  role,
}: {
  conversationId: string;
  role: "member" | "wali";
}) {
  const [state, action] = useActionState(closeConversation.bind(null, conversationId), EMPTY);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 flex h-11 w-full items-center justify-center text-[18px] text-text underline-offset-2 hover:underline"
      >
        End this conversation
      </button>
    );
  }

  return (
    <form action={action} className="mt-6 flex flex-col gap-3 border-t border-soft-green pt-5">
      <FormError>{state.error}</FormError>
      <p className="text-[18px] leading-[26px] text-text">
        {role === "wali"
          ? "Ending it stops both of them writing. Nothing already said is removed, and both are told it has ended."
          : "Ending it stops both of you writing. Nothing already said is removed, and your wali is told."}
      </p>
      <input
        name="reason"
        placeholder="Anything you want recorded (optional)"
        className="h-11 w-full rounded-md border border-soft-green bg-white px-3 text-[18px] text-black outline-none focus:border-accent-deep"
      />
      <SubmitButton>End it</SubmitButton>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-center text-[18px] text-text underline-offset-2 hover:underline"
      >
        Never mind
      </button>
    </form>
  );
}
