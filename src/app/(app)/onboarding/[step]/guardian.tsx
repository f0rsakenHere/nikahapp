"use client";

import { useActionState, useState } from "react";
import {
  cancelInvitation,
  inviteWali,
  nominateModeratorAsWali,
  replaceWali,
  resendInvitation,
  type WaliState,
} from "@/lib/guardianship/actions";
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

/* `min-h-12` rather than `h-12`: at 320 the label wraps, and a fixed
   height sent the second line across the border. See the same note in
   settings/lifecycle.tsx. */
const GHOST =
  "flex min-h-12 w-full items-center justify-center rounded-pill border-2 border-accent-deep px-4 py-2 text-center text-[18px] font-semibold leading-[26px] text-accent-deep";

export type Pending = { name: string; email: string; invitedAt: string; reminders: number };
export type Confirmed = { name: string; email: string; relationship: string; confirmedAt: string };

/** The form itself, shared between naming a wali and replacing one. */
function WaliFields({ v }: { v: NonNullable<WaliState["values"]> }) {
  return (
    <>
      <TextField
        label="His full name"
        name="name"
        defaultValue={v.name}
        placeholder="Ahmed Al-Rashid"
        autoComplete="off"
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-[18px] font-semibold uppercase tracking-[0.6px] text-text/70">
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
          className="h-12 w-full rounded-md border border-soft-green bg-white px-3.5 text-[18px] text-black outline-none focus:border-accent-deep"
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
    </>
  );
}

/** Hers alone. A brother has no wali step and cannot reach this screen —
 *  see HIDDEN_FROM in domain/profile.ts. */
export function GuardianStep({
  pending,
  confirmed,
  moderatorAvailable,
}: {
  pending: Pending | null;
  confirmed: Confirmed | null;
  /** Whether anybody is actually sitting in the moderator's seat. */
  moderatorAvailable: boolean;
}) {
  const [state, action] = useActionState(inviteWali, EMPTY);
  const [moderatorState, moderatorAction] = useActionState(
    async () => nominateModeratorAsWali(),
    EMPTY
  );
  const [resendState, resendAction] = useActionState(
    async (prev: WaliState) => resendInvitation(prev),
    EMPTY
  );
  const [replaceState, replaceAction] = useActionState(replaceWali, EMPTY);
  const [replacing, setReplacing] = useState(false);

  /* ---------------------------------------------- he has confirmed -- */
  if (confirmed && !replacing && !replaceState.done) {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-md border border-soft-green bg-mist px-4 py-4">
          <p className="text-[18px] font-semibold text-black">{confirmed.name}</p>
          <p className="mt-1 text-[18px] leading-[26px] text-text">
            Confirmed {confirmed.confirmedAt}. He sees everything you do, and no conversation
            opens without him.
          </p>
        </div>

        {/* §6.2. A wali who confirmed and then stopped answering is the
            failure that strands people: she cannot proceed and cannot
            leave. This is the way out, and it is deliberately not hidden
            behind a support email. */}
        <div className="rounded-md border border-soft-green px-4 py-4">
          <p className="text-[18px] font-semibold text-black">If he can no longer act for you</p>
          <p className="mt-1 text-[18px] leading-[26px] text-text">
            Someone else can take his place. He loses access immediately, and the person who
            replaces him does not see anything from before he confirms.
          </p>
          <button type="button" className={`${GHOST} mt-3`} onClick={() => setReplacing(true)}>
            Name somebody else
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------- replacing him -- */
  if (confirmed || replaceState.done) {
    if (replaceState.done) {
      return (
        <div className="flex flex-col gap-5">
          <div className="rounded-md border border-soft-green bg-mist px-4 py-4">
            <p className="text-[18px] font-semibold text-black">Waiting on him</p>
            <p className="mt-1 text-[18px] leading-[26px] text-text">{replaceState.done}</p>
          </div>
          <DevLink href={replaceState.devLink} />
        </div>
      );
    }

    return (
      <form action={replaceAction} className="flex flex-col gap-6" noValidate>
        <FormError>{replaceState.error}</FormError>
        <div className="rounded-md border border-peach/40 bg-soft-peach/60 px-4 py-4">
          <p className="text-[18px] leading-[26px] text-black/75">
            {confirmed?.name} loses access the moment you send this. Your profile stops being
            shown until the new wali confirms.
          </p>
        </div>
        <WaliFields v={replaceState.values ?? {}} />
        <SubmitButton>Send the invitation</SubmitButton>
        <button
          type="button"
          onClick={() => setReplacing(false)}
          className="text-center text-[18px] text-text underline-offset-2 hover:underline"
        >
          Never mind
        </button>
      </form>
    );
  }

  /* ------------------------------------------- invited, no answer -- */
  if (pending || state.done) {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-md border border-soft-green bg-mist px-4 py-4">
          <p className="text-[18px] font-semibold text-black">Waiting on him</p>
          <p className="mt-1 text-[18px] leading-[26px] text-text">
            {pending
              ? `We have written to ${pending.name} at ${pending.email}. Your profile goes to review once he confirms.`
              : state.done}
          </p>
          {pending ? (
            <p className="mt-2 text-[18px] text-text/70">
              Sent {pending.invitedAt}
              {pending.reminders ? ` · reminded ${pending.reminders} time${pending.reminders === 1 ? "" : "s"}` : ""}
            </p>
          ) : null}
        </div>

        <DevLink href={state.devLink} />

        {pending ? (
          <form action={resendAction}>
            <FormError>{resendState.error}</FormError>
            {resendState.done ? (
              <p className="mb-2 text-[18px] text-accent-deep">{resendState.done}</p>
            ) : null}
            <button type="submit" className={GHOST}>
              Send it to him again
            </button>
          </form>
        ) : null}

        <form action={cancelInvitation}>
          <button type="submit" className={GHOST}>
            Cancel and invite someone else
          </button>
        </form>
      </div>
    );
  }

  /* ---------------------------------------------- nobody named yet -- */
  return (
    <div className="flex flex-col gap-7">
      <form action={action} className="flex flex-col gap-6" noValidate>
        <FormError>{state.error}</FormError>

        <div className="rounded-md border border-peach/40 bg-soft-peach/60 px-4 py-4">
          <p className="text-[18px] font-semibold text-peach-deep">He will be able to:</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {POWERS.map((p) => (
              <li key={p} className="text-[18px] leading-[26px] text-black/75">
                · {p}
              </li>
            ))}
          </ul>
        </div>

        <WaliFields v={state.values ?? {}} />

        <SubmitButton>Send his invitation</SubmitButton>
      </form>

      {/* The way through for a woman with nobody to ask. Offered second,
          not first: where there is a father or a brother, he is the
          right answer, and leading with the service would quietly
          replace a family's role with a company's. Shown only when the
          seat is actually staffed. */}
      {moderatorAvailable ? (
        <div className="rounded-md border border-soft-green bg-mist px-4 py-4">
          <p className="text-[18px] font-semibold text-black">If there is nobody you can ask</p>
          <p className="mt-1 text-[18px] leading-[26px] text-text">
            A NikahCanada moderator can act as your wali. He has exactly the powers listed above —
            he reads everything and approves before any conversation opens — and you can replace him
            with a relative at any time.
          </p>
          <form action={moderatorAction} className="mt-3">
            <FormError>{moderatorState.error}</FormError>
            {moderatorState.done ? (
              <p className="mb-2 text-[18px] text-accent-deep">{moderatorState.done}</p>
            ) : null}
            <button type="submit" className={GHOST}>
              Ask a NikahCanada moderator
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
