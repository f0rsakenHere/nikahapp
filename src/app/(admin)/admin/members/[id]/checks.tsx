"use client";

import { useActionState } from "react";
import {
  decideVerification,
  recordIntakeCall,
  recordReferenceCall,
  verifyWali,
  type VerifyState,
} from "@/lib/admin/verification-actions";
import { REFERENCE_OUTCOMES, type Verification } from "@/lib/domain/verification";
import { FormError, SubmitButton } from "@/components/app/form";

const EMPTY: VerifyState = {};

const KIND_LABELS: Record<Verification["kind"], string> = {
  identity: "Identity",
  reference: "Reference call",
  intakeCall: "Intake call",
};

const REFERENCE_LABELS: Record<(typeof REFERENCE_OUTCOMES)[number], string> = {
  vouched: "Vouched for them",
  declinedToComment: "Declined to comment",
  concerns: "Raised concerns",
  unreachable: "Could not be reached",
  wrongNumber: "Wrong number",
};

const FIELD =
  "w-full rounded-md border border-soft-green bg-white px-3 py-2 text-[13px] text-black outline-none focus:border-accent-deep";

function Decide({ id }: { id: string }) {
  const [state, action] = useActionState(decideVerification.bind(null, id), EMPTY);
  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      <FormError>{state.error}</FormError>
      <div className="flex gap-2">
        <select name="outcome" defaultValue="" className={FIELD}>
          <option value="">Decide…</option>
          <option value="approve">Approve</option>
          <option value="askForMore">Ask for more</option>
          <option value="reject">Reject</option>
        </select>
      </div>
      <input name="reason" placeholder="Reason (required to reject or ask)" className={FIELD} />
      <SubmitButton>Record</SubmitButton>
    </form>
  );
}

function ReferenceCall({ v }: { v: Verification }) {
  const [state, action] = useActionState(recordReferenceCall.bind(null, v.id), EMPTY);
  return (
    <form action={action} className="mt-3 flex flex-col gap-2 border-t border-soft-green pt-3">
      <FormError>{state.error}</FormError>
      <p className="text-[12px] text-text">
        {v.reference?.name ?? "—"}
        {v.reference?.relationship ? ` · ${v.reference.relationship}` : ""}
        {v.reference?.phone ? ` · ${v.reference.phone}` : ""}
      </p>
      <select name="outcome" defaultValue="" className={FIELD}>
        <option value="">What happened on the call…</option>
        {REFERENCE_OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {REFERENCE_LABELS[o]}
          </option>
        ))}
      </select>
      <input name="notes" placeholder="Notes" className={FIELD} />
      <SubmitButton>Record the call</SubmitButton>
    </form>
  );
}

function IntakeCall({ v }: { v: Verification }) {
  const [state, action] = useActionState(recordIntakeCall.bind(null, v.id), EMPTY);
  const scheduled = Boolean(v.call?.scheduledFor);
  return (
    <form action={action} className="mt-3 flex flex-col gap-2 border-t border-soft-green pt-3">
      <FormError>{state.error}</FormError>
      {scheduled ? (
        <>
          <p className="text-[12px] text-text">
            Arranged for{" "}
            {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(
              v.call!.scheduledFor!
            )}
            {v.call?.completedAt ? " · done" : ""}
          </p>
          <input type="hidden" name="completing" value="on" />
          <input name="notes" placeholder="What was said" className={FIELD} />
          <SubmitButton>Mark the call done</SubmitButton>
        </>
      ) : (
        <>
          <input type="date" name="scheduledFor" className={FIELD} />
          <SubmitButton>Arrange the call</SubmitButton>
        </>
      )}
    </form>
  );
}

export function ChecksPanel({
  verifications,
  guardianship,
}: {
  verifications: Verification[];
  guardianship: { id: string; name: string; verified: boolean } | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {verifications.length === 0 ? (
        <p className="text-[13px] text-text/70">
          No checks have been opened. They are created when a profile is submitted.
        </p>
      ) : null}

      {verifications.map((v) => (
        <div key={v.id} className="rounded-md border border-soft-green p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-semibold text-black">{KIND_LABELS[v.kind]}</span>
            <span
              className={`text-[12px] ${
                v.decision === "approved"
                  ? "text-accent-deep"
                  : v.decision === "rejected"
                    ? "text-peach-deep"
                    : "text-text/70"
              }`}
            >
              {v.decision}
            </span>
          </div>

          {v.kind === "identity" ? (
            /* No upload control. Object storage is not configured, and a
               file input that drops the file on the floor is worse than
               an honest sentence — see §7.5. */
            <p className="mt-2 rounded-md border border-peach/40 bg-soft-peach/60 px-3 py-2 text-[12px] leading-[17px] text-text">
              Document upload needs private object storage in a Canadian region, which is not set
              up. Check the document however you do today and record the outcome here.
            </p>
          ) : null}

          {v.kind === "reference" && v.decision === "pending" ? <ReferenceCall v={v} /> : null}
          {v.kind === "intakeCall" && v.decision === "pending" ? <IntakeCall v={v} /> : null}

          {v.decision === "pending" || v.decision === "moreInfoNeeded" ? <Decide id={v.id} /> : null}

          {v.reason ? <p className="mt-2 text-[12px] text-text">{v.reason}</p> : null}
        </div>
      ))}

      {guardianship ? <WaliCheck guardianship={guardianship} /> : null}
    </div>
  );
}

function WaliCheck({
  guardianship,
}: {
  guardianship: { id: string; name: string; verified: boolean };
}) {
  const [state, action] = useActionState(verifyWali.bind(null, guardianship.id), EMPTY);

  return (
    <div className="rounded-md border border-soft-green p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[14px] font-semibold text-black">Her wali</span>
        <span className={`text-[12px] ${guardianship.verified ? "text-accent-deep" : "text-text/70"}`}>
          {guardianship.verified ? "verified" : "not checked"}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-text">{guardianship.name}</p>

      {guardianship.verified ? null : (
        <form action={action} className="mt-3 flex flex-col gap-2">
          <FormError>{state.error}</FormError>
          {/* D10. He holds a veto over her marriage prospects and reads
              her private correspondence; "we spoke to him" is the record
              that has to exist before that is true. */}
          <input name="method" placeholder="How he was checked" className={FIELD} />
          <SubmitButton>Record that he is verified</SubmitButton>
        </form>
      )}
    </div>
  );
}
