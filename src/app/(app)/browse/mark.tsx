"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setMark, type MarkState } from "@/lib/shortlist/actions";
import { HeartIcon, PassIcon } from "@/components/app/icons";

const EMPTY: MarkState = {};

/* Save, or pass.
 *
 * One form with two submit buttons, not two forms. Each button carries
 * the mark it means in its own value, so the press is still a single
 * submit with a fixed meaning and still works before hydration and
 * without JavaScript — but there is now one piece of state behind both
 * of them rather than two that took it in turns to be believed.
 *
 * Pressing the one that is already on removes the mark; the second
 * press of a heart is always "actually, no". The server decides that
 * against what is stored, so a card left open for a while cannot talk
 * it into removing a mark that was never there.
 *
 * Nothing opts back into pointer events any more. The card used to be
 * covered by a stretched link, which meant every button on it had to
 * declare itself touchable inside a parent that had switched touching
 * off — and on an iPhone that is where these two stopped responding.
 * The link wraps the card's reading matter now and these sit beside it.
 *
 * The buttons answer the finger rather than the network. A mark is a
 * write to Montreal and back, which on a phone is two or three seconds
 * — and for all of that time the old pair of buttons sat there looking
 * exactly as they had before the tap. That is what a dead button looks
 * like, and it is why both of these were reported as not working. They
 * now light up on the press and stay lit while the write is in the air.
 */

function MarkButton({
  value,
  on,
  onLabel,
  offLabel,
  onClassName,
  offClassName,
  children,
}: {
  value: "saved" | "passed";
  on: boolean;
  onLabel: string;
  offLabel: string;
  onClassName: string;
  offClassName: string;
  children: React.ReactNode;
}) {
  /* `data` is the form being submitted right now, so a button can tell
     whether it is the one that was pressed. Without it, pressing the
     heart would light the pass button too. */
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("mark") === value;

  /* Mid-flight it shows the state it is asking for, not the one it has.
     If the write fails the next render puts it back. */
  const lit = mine ? !on : on;

  return (
    <button
      type="submit"
      name="mark"
      value={value}
      aria-pressed={lit}
      title={lit ? onLabel : offLabel}
      className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-[19px] transition-colors ${
        lit ? onClassName : offClassName
      }`}
    >
      {children}
      <span className="sr-only">{lit ? onLabel : offLabel}</span>
    </button>
  );
}

export function MarkButtons({
  profileId,
  current,
}: {
  profileId: string;
  current: "saved" | "passed" | "none";
}) {
  const [state, submit] = useActionState(setMark.bind(null, profileId), EMPTY);

  /* The action's answer wins over the server's prop for the rest of this
     render — the list revalidates behind it, and until it does the
     button should already look pressed. */
  const kind = state.kind ?? current;

  return (
    <form action={submit} className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <MarkButton
          value="saved"
          on={kind === "saved"}
          onLabel="Saved. Press to remove"
          offLabel="Save to think about"
          onClassName="border-peach bg-peach text-black"
          offClassName="border-soft-green text-text hover:border-peach hover:text-peach-deep"
        >
          <HeartIcon />
        </MarkButton>

        <MarkButton
          value="passed"
          on={kind === "passed"}
          onLabel="Passed. Press to undo"
          offLabel="Not for me"
          onClassName="border-text/40 bg-mist text-text"
          offClassName="border-soft-green text-text hover:border-text/40"
        >
          <PassIcon />
        </MarkButton>
      </div>

      {/* It used to return a refusal that nothing rendered, so a mark the
          server would not make was indistinguishable from one it had. */}
      {state.error ? (
        <p role="alert" className="text-[18px] leading-[26px] text-peach-deep">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
