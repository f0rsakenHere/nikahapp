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
        <div className="flex items-center gap-3 rounded-md border border-soft-green bg-white p-3.5">
          <Initials size={46}>Y.K</Initials>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-black">Brother · 29 · Toronto</span>
            <span className="text-[11px] text-text">Connected Tuesday · 22 messages</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-md bg-soft-peach/60 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-black/75">Matchmaking fee</span>
            <span className="font-playfair text-[26px] font-bold leading-[1.2] text-black">$149</span>
          </div>
          <span className="text-[11px] leading-[16px] text-text">
            Charged once, to each side. Nothing was charged to register, to browse, or to be
            referred.
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
            Both sides must pay
          </span>

          <div className="flex items-center gap-3 rounded-md border border-soft-green bg-white px-3.5 py-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/25 text-accent-deep">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1 text-[13px] text-black">You</span>
            <Chip tone="accent">Paid</Chip>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-soft-green bg-white px-3.5 py-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-soft-green text-text/40">
              <span className="text-[10px]">·</span>
            </span>
            <span className="flex-1 text-[13px] text-black">Your match</span>
            <Chip>Awaiting</Chip>
          </div>
        </div>

        <p className="text-[11px] leading-[16px] text-text">
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
        <div className="flex flex-col items-center gap-2.5 rounded-md bg-accent/12 p-5 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/25 text-accent-deep">
            <Check className="h-5 w-5" />
          </span>
          <span className="font-playfair text-[19px] font-bold text-black">Both payments received</span>
          <span className="text-[11px] leading-[16px] text-text">
            You may now speak directly, with your families involved.
          </span>
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-soft-green bg-white p-4">
          <div className="flex items-center gap-3">
            <Initials size={44}>Y.K</Initials>
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-black">Yusuf Karim</span>
              <span className="text-[11px] text-text">Toronto, Ontario</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-soft-green pt-3">
            {[
              ["Mobile", "+1 416 555 0177"],
              ["Email", "y.karim@email.com"],
              ["Wali / reference", "Imam Bilal · +1 416 555 0102"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.5px] text-text/60">{k}</span>
                <span className="text-[12px] text-black">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-md bg-soft-peach/60 p-3.5">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-peach-deep" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
            <circle cx="12" cy="12" r="2.6" />
          </svg>
          <span className="text-[11px] leading-[16px] text-black/75">
            Ahmed Al-Rashid received these same details at the same moment.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-6">
        <Btn>Message your wali</Btn>
        <p className="text-center text-[11px] text-text/70">
          We will check in with you both in two weeks.
        </p>
      </div>

      <HomeBar />
    </div>
  );
}
