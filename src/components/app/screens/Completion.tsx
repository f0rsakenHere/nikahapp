import { AppBar, Btn, Check, Chip, Initials } from "@/components/app/kit";
import { HomeBar } from "@/components/app/Phone";

/* 9 — The matchmaking fee. Step five on the live site: it falls due only
   once both sides want to proceed, and both pay before contact details
   move. NOTE: the amount below is a placeholder — see content/howItWorks. */
export function FeeScreen() {
  return (
    <div className="flex h-full flex-col pb-10">
      <AppBar back title="Matchmaking fee" />

      <div className="flex flex-1 flex-col gap-5 px-6">
        <div className="flex items-center gap-3 rounded-md border border-line bg-white p-3.5">
          <Initials size={46}>Y.K</Initials>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-ink">Brother · 29 · Toronto</span>
            <span className="text-[11px] text-body">Introduced Tuesday · 22 messages</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-md bg-brass-tint/60 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-ink/75">Matchmaking fee</span>
            <span className="font-display text-[26px] leading-none text-ink">$149</span>
          </div>
          <span className="text-[11px] leading-[16px] text-body">
            Charged once, to each side. Nothing was charged to register, to be searched for, or to
            be introduced.
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-body/70">
            Both sides must pay
          </span>

          <div className="flex items-center gap-3 rounded-md border border-line bg-white px-3.5 py-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sage/25 text-sage">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1 text-[13px] text-ink">You</span>
            <Chip tone="sage">Paid</Chip>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-line bg-white px-3.5 py-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-line text-body/40">
              <span className="text-[10px]">·</span>
            </span>
            <span className="flex-1 text-[13px] text-ink">Your match</span>
            <Chip>Awaiting</Chip>
          </div>
        </div>

        <p className="text-[11px] leading-[16px] text-body">
          Contact details are exchanged only once both payments clear. If he does not pay, nothing
          is shared and you are refunded.
        </p>
      </div>

      <div className="px-6">
        <Btn>Pay the fee</Btn>
      </div>

      <HomeBar />
    </div>
  );
}

/* 10 — Contact shared. Step six: the last thing the platform does. Names
   and details go to both members and to the wali at the same moment. */
export function ContactShared() {
  return (
    <div className="flex h-full flex-col pb-10">
      <AppBar back title="Contact shared" />

      <div className="flex flex-1 flex-col gap-5 px-6">
        <div className="flex flex-col items-center gap-2.5 rounded-md bg-sage/12 p-5 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-sage/25 text-sage">
            <Check className="h-5 w-5" />
          </span>
          <span className="font-display text-[19px] text-ink">Both payments received</span>
          <span className="text-[11px] leading-[16px] text-body">
            You may now speak directly, with your families involved.
          </span>
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-line bg-white p-4">
          <div className="flex items-center gap-3">
            <Initials size={44}>Y.K</Initials>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-ink">Yusuf Karim</span>
              <span className="text-[11px] text-body">Toronto, Ontario</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            {[
              ["Mobile", "+1 416 555 0177"],
              ["Email", "y.karim@email.com"],
              ["Wali / reference", "Imam Bilal · +1 416 555 0102"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.5px] text-body/60">{k}</span>
                <span className="text-[12px] text-ink">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-md bg-brass-tint/60 p-3.5">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-brass" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
            <circle cx="12" cy="12" r="2.6" />
          </svg>
          <span className="text-[11px] leading-[16px] text-ink/75">
            Ahmed Al-Rashid received these same details at the same moment.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-6">
        <Btn>Message your wali</Btn>
        <p className="text-center text-[11px] text-body/70">
          We will check in with you both in two weeks.
        </p>
      </div>

      <HomeBar />
    </div>
  );
}
