"use client";

import { useActionState } from "react";
import { setMark, type MarkState } from "@/lib/shortlist/actions";
import { HeartIcon, PassIcon } from "@/components/app/icons";

const EMPTY: MarkState = {};

/* Save, or pass.
 *
 * Two small forms rather than one control with a mode: each is a single
 * submit with a fixed meaning, which keeps them working before hydration
 * and without JavaScript. Pressing the one that is already on removes
 * the mark — the second press of a heart is always "actually, no".
 */
export function MarkButtons({
  profileId,
  current,
}: {
  profileId: string;
  current: "saved" | "passed" | "none";
}) {
  const [savedState, save] = useActionState(
    setMark.bind(null, profileId, current === "saved" ? "none" : "saved"),
    EMPTY
  );
  const [passedState, pass] = useActionState(
    setMark.bind(null, profileId, current === "passed" ? "none" : "passed"),
    EMPTY
  );

  /* The action's answer wins over the server's prop for the rest of this
     render — the list revalidates behind it, and until it does the
     button should already look pressed. */
  const kind = savedState.kind ?? passedState.kind ?? current;
  const saved = kind === "saved";
  const passed = kind === "passed";

  return (
    <div className="pointer-events-auto flex gap-2">
      <form action={save}>
        <button
          type="submit"
          aria-pressed={saved}
          title={saved ? "Saved — press to remove" : "Save to think about"}
          className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-[19px] transition-colors ${
            saved
              ? "border-peach bg-peach text-black"
              : "border-soft-green text-text hover:border-peach hover:text-peach-deep"
          }`}
        >
          <HeartIcon />
          <span className="sr-only">{saved ? "Remove from saved" : "Save"}</span>
        </button>
      </form>

      <form action={pass}>
        <button
          type="submit"
          aria-pressed={passed}
          title={passed ? "Passed — press to undo" : "Not for me"}
          className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-[19px] transition-colors ${
            passed
              ? "border-text/40 bg-mist text-text"
              : "border-soft-green text-text hover:border-text/40"
          }`}
        >
          <PassIcon />
          <span className="sr-only">{passed ? "Undo pass" : "Not for me"}</span>
        </button>
      </form>
    </div>
  );
}
