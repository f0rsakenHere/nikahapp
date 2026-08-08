"use client";

import { useActionState } from "react";
import { decide, type DecisionState } from "@/lib/admin/actions";
import { FormError, SubmitButton } from "@/components/app/form";

const EMPTY: DecisionState = {};

const OUTCOMES = [
  {
    value: "live",
    label: "Approve — the profile goes live",
    tone: "text-accent-deep",
  },
  {
    value: "verifying",
    label: "Hold for identity and reference checks",
    tone: "text-text",
  },
  {
    value: "rejected",
    label: "Decline",
    tone: "text-peach-deep",
  },
] as const;

export function DecisionForm({
  profileId,
  blocked,
  status,
}: {
  profileId: string;
  blocked: boolean;
  status: string;
}) {
  const action = decide.bind(null, profileId);
  const [state, formAction] = useActionState(action, EMPTY);

  if (state.done) {
    return (
      <p className="rounded-md border border-soft-green bg-mist px-4 py-3 text-[13px] text-black">
        Recorded: {state.done === "live" ? "approved and live" : state.done}.
      </p>
    );
  }

  if (status !== "pendingReview" && status !== "verifying") {
    return (
      <p className="text-[13px] text-text">
        Already decided — this profile is <strong>{status}</strong>.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormError>{state.error}</FormError>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="sr-only">Decision</legend>
        {OUTCOMES.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-soft-green px-3.5 py-2.5 has-[:checked]:border-accent-deep has-[:checked]:bg-accent/12"
          >
            <input
              type="radio"
              name="decision"
              value={o.value}
              /* Approve is offered even when blocked, and refused by the
                 server with the reason. Hiding it would leave a reviewer
                 guessing why the option vanished; refusing it explains. */
              className="h-4 w-4 shrink-0 accent-accent-deep"
            />
            <span className={`text-[14px] ${o.tone}`}>{o.label}</span>
          </label>
        ))}
      </fieldset>

      {blocked ? (
        <p className="text-[12px] leading-[17px] text-text/70">
          Approving will be refused while anything above is outstanding.
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
          Reason
        </span>
        <textarea
          name="reason"
          rows={3}
          className="w-full rounded-md border border-soft-green bg-white px-3.5 py-2.5 text-[14px] leading-[21px] text-black outline-none focus:border-accent-deep"
        />
        <span className="text-[11px] text-text/70">
          Required to decline. Recorded in the audit log, and the member may ask.
        </span>
      </label>

      <SubmitButton>Record the decision</SubmitButton>
    </form>
  );
}
