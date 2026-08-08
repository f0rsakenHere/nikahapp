"use client";

import { useActionState } from "react";
import { cancelInvitation, inviteWali, type WaliState } from "@/lib/guardianship/actions";
import { WALI_RELATIONSHIPS } from "@/lib/domain/guardianship";
import { DevLink, FormError, SubmitButton, TextField } from "@/components/app/form";

const EMPTY: WaliState = {};

const RELATIONSHIP_LABELS: Record<(typeof WALI_RELATIONSHIPS)[number], string> = {
  father: "My father",
  grandfather: "My grandfather",
  brother: "My brother",
  uncle: "My uncle",
  sonOfBrother: "My brother's son",
  imam: "The imam of my masjid",
  other: "Someone else",
};

/* His four powers, in the order they happen. Spelled out before a single
 * detail is asked for — the /how-it-works page promises exactly that,
 * and it is the honest thing to do: she is handing someone read access
 * to her private correspondence. */
const POWERS = [
  "See every introduction you receive, the moment you do",
  "Read every message you exchange",
  "Approve or decline before any conversation opens",
  "End a conversation at any point",
];

export function GuardianStep({
  pending,
}: {
  pending: { name: string; email: string; invitedAt: string } | null;
}) {
  const [state, action] = useActionState(inviteWali, EMPTY);
  const v = state.values ?? {};

  if (pending || state.done) {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-md border border-soft-green bg-mist px-4 py-4">
          <p className="text-[14px] font-semibold text-black">Waiting on him</p>
          <p className="mt-1 text-[13px] leading-[20px] text-text">
            {pending
              ? `We have written to ${pending.name} at ${pending.email}. Your profile goes to review once he confirms.`
              : state.done}
          </p>
          {pending ? (
            <p className="mt-2 text-[11px] text-text/70">Sent {pending.invitedAt}</p>
          ) : null}
        </div>

        <DevLink href={state.devLink} />

        <form action={cancelInvitation}>
          <button
            type="submit"
            className="h-12 w-full rounded-pill border-2 border-accent-deep text-[14px] font-semibold text-accent-deep"
          >
            Cancel and invite someone else
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormError>{state.error}</FormError>

      <div className="rounded-md border border-peach/40 bg-soft-peach/60 px-4 py-4">
        <p className="text-[13px] font-semibold text-peach-deep">He will be able to:</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {POWERS.map((p) => (
            <li key={p} className="text-[13px] leading-[19px] text-black/75">
              · {p}
            </li>
          ))}
        </ul>
      </div>

      <TextField
        label="His full name"
        name="name"
        defaultValue={v.name}
        placeholder="Ahmed Al-Rashid"
        autoComplete="off"
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
          Who he is to you
        </span>
        <select
          /* Remounted when the echoed value changes. React applies a
             `<select>`'s defaultValue at mount only, so after a rejected
             submit the text fields kept what she typed and this one
             silently reset — which then failed validation on the *next*
             submit for a field she could see was filled in. */
          key={`relationship-${v.relationship ?? ""}`}
          name="relationship"
          defaultValue={v.relationship ?? ""}
          className="h-12 w-full rounded-md border border-soft-green bg-white px-3.5 text-[15px] text-black outline-none focus:border-accent-deep"
        >
          <option value="">Choose…</option>
          {WALI_RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {RELATIONSHIP_LABELS[r]}
            </option>
          ))}
        </select>
      </label>

      <TextField
        label="His email"
        name="email"
        type="email"
        defaultValue={v.email}
        autoComplete="off"
        hint="The invitation goes here. Check it carefully — we cannot send it twice to two different addresses."
      />

      <TextField
        label="His phone number"
        name="phone"
        defaultValue={v.phone}
        placeholder="Optional"
        autoComplete="off"
        hint="Only used if he does not answer the email."
      />

      <SubmitButton>Send his invitation</SubmitButton>
    </form>
  );
}
