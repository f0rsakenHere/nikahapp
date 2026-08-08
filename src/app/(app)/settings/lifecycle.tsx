"use client";

import { useActionState, useState } from "react";
import {
  changeLifecycle,
  eraseAccount,
  requestExport,
  type LifecycleState,
} from "@/lib/profile/lifecycle-actions";
import { FormError, SubmitButton, TextField } from "@/components/app/form";

const EMPTY: LifecycleState = {};

const GHOST =
  "h-12 w-full rounded-pill border-2 border-accent-deep text-[14px] font-semibold text-accent-deep";

export function PauseOrResume({ status }: { status: string }) {
  const paused = status === "paused";
  const [state, action] = useActionState(
    changeLifecycle.bind(null, paused ? "resume" : "pause"),
    EMPTY
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <FormError>{state.error}</FormError>
      <p className="text-[13px] leading-[20px] text-text">
        {paused
          ? "Your profile is paused. Nobody can see it and no introductions will reach you."
          : "Pausing hides your profile and stops introductions. Nothing is deleted, and you can come back."}
      </p>
      <button type="submit" className={GHOST}>
        {paused ? "Make my profile visible again" : "Pause my profile"}
      </button>
    </form>
  );
}

export function ExportData() {
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] leading-[20px] text-text">
        A copy of everything we hold about you, as a JSON file. It does not include your password
        or your two-factor secret — those are credentials, not information about you.
      </p>
      <button
        type="button"
        disabled={busy}
        className={GHOST}
        onClick={async () => {
          setBusy(true);
          const result = await requestExport();
          setBusy(false);
          if (!result) return;
          /* Built in the browser and never written to a server disk: a
             file containing everything about a member, sitting
             somewhere, is what this feature exists to avoid. */
          const url = URL.createObjectURL(new Blob([result.json], { type: "application/json" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = result.filename;
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        {busy ? "Preparing…" : "Download my data"}
      </button>
    </div>
  );
}

export function WithdrawOrDelete({ status }: { status: string }) {
  const [open, setOpen] = useState<null | "withdraw" | "delete">(null);
  const [withdrawState, withdrawAction] = useActionState(
    changeLifecycle.bind(null, "withdraw"),
    EMPTY
  );
  const [eraseState, eraseAction] = useActionState(eraseAccount, EMPTY);

  const gone = status === "withdrawn";

  if (open === "withdraw") {
    return (
      <form action={withdrawAction} className="flex flex-col gap-3">
        <FormError>{withdrawState.error}</FormError>
        <p className="text-[13px] leading-[20px] text-text">
          Your profile stops being shown and no more introductions will reach you. Your account
          stays, so you can talk to us. This cannot be undone from here.
        </p>
        <TextField label="Your password" name="password" type="password" autoComplete="current-password" />
        <SubmitButton>Withdraw my profile</SubmitButton>
        <button type="button" onClick={() => setOpen(null)} className="text-[13px] text-text underline-offset-2 hover:underline">
          Never mind
        </button>
      </form>
    );
  }

  if (open === "delete") {
    return (
      <form action={eraseAction} className="flex flex-col gap-3">
        <FormError>{eraseState.error}</FormError>
        <p className="text-[13px] leading-[20px] text-text">
          Everything goes: your account, your profile, your wali&apos;s link to you, and our
          record of the checks we made. Download your data first if you want a copy — afterwards
          we cannot produce one.
        </p>
        <p className="text-[12px] leading-[18px] text-text/70">
          One thing survives, deliberately: our log of what happened and when, with you removed
          from it. It is how we can answer questions about the service without holding anything
          that identifies you.
        </p>
        <TextField label="Your password" name="password" type="password" autoComplete="current-password" />
        <TextField label="Type DELETE to confirm" name="confirm" />
        <SubmitButton>Delete everything</SubmitButton>
        <button type="button" onClick={() => setOpen(null)} className="text-[13px] text-text underline-offset-2 hover:underline">
          Never mind
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {gone ? null : (
        <button type="button" className={GHOST} onClick={() => setOpen("withdraw")}>
          Withdraw my profile
        </button>
      )}
      <button
        type="button"
        className="h-12 w-full rounded-pill border-2 border-soft-green text-[14px] font-semibold text-peach-deep"
        onClick={() => setOpen("delete")}
      >
        Delete my account and everything in it
      </button>
    </div>
  );
}
