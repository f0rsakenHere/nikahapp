import { AppBar, BottomNav, Btn, Check, Chip, Initials, WaliBanner } from "@/components/app/kit";
import { HomeBar } from "@/components/app/Phone";

/* 7 — The conversation. The wali banner is pinned under the header and
   cannot be dismissed, and the composer says messages are permanent.
   Both parties see the same thing. */
export function Chat() {
  const messages = [
    { from: "them", text: "Assalamu alaikum. Thank you for accepting my connection." },
    { from: "me", text: "Wa alaikum assalam. My father is on this conversation, as you know." },
    { from: "them", text: "Of course — that is why I applied here. May I ask what you are looking for in the next year?" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-soft-green px-6 pb-3 pt-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-soft-green text-black">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <Initials size={38}>Y.K</Initials>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold text-black">Brother · 29</span>
          <span className="text-[11px] text-text">Toronto · Connected Tuesday</span>
        </div>
      </div>

      <WaliBanner name="Ahmed Al-Rashid (your wali)" />

      <div className="flex flex-1 flex-col gap-3 px-5 py-4">
        <p className="mx-auto max-w-[280px] rounded-md bg-soft-green/40 px-3 py-2 text-center text-[11px] leading-[15px] text-text">
          Ahmed Al-Rashid approved this conversation on Tuesday at 20:15 and joined it.
        </p>

        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[78%] rounded-lg px-3.5 py-2.5 text-[13px] leading-[19px] ${
              m.from === "me"
                ? "self-end rounded-br-sm bg-accent text-black"
                : "self-start rounded-bl-sm border border-soft-green bg-white text-black"
            }`}
          >
            {m.text}
          </div>
        ))}

        <p className="mx-auto max-w-[290px] text-center text-[10px] leading-[14px] text-text/60">
          Contact details are exchanged at the final step, not here.
        </p>
      </div>

      <div className="border-t border-soft-green bg-white px-5 pb-8 pt-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-11 flex-1 items-center rounded-pill border border-soft-green px-4 text-[13px] text-text/45">
            Write a message…
          </span>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-peach text-black">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <p className="mt-2 text-center text-[10px] text-text/60">
          Messages cannot be edited or deleted.
        </p>
      </div>
    </div>
  );
}

/* 8 — The wali's own view. He is a first-class user with his own account,
   not a CC on an email. This is the screen that makes the model real. */
export function WaliPortal() {
  return (
    <div className="flex h-full flex-col">
      <AppBar title="Wali portal" sub="You are the registered guardian for Fatima Al-Rashid." />

      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-6">
        <div className="flex flex-col gap-3 rounded-md border border-peach/40 bg-soft-peach/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-peach-deep">
              Awaiting your approval
            </span>
            <Chip tone="peach">1</Chip>
          </div>

          <div className="flex gap-3">
            <Initials size={46}>Y.K</Initials>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[14px] font-semibold text-black">Brother · 29 · Toronto</span>
              <span className="text-[11px] leading-[15px] text-text">
                Software engineer · Five daily · Hanafi · Identity verified
              </span>
            </div>
          </div>

          <div className="flex gap-2.5">
            <Btn variant="danger" className="flex-1 !h-10">
              Decline
            </Btn>
            <Btn className="flex-1 !h-10">Approve</Btn>
          </div>
          <span className="text-[10px] leading-[14px] text-text/70">
            Approving opens a conversation you can read in full at any time.
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
            Open conversations
          </span>

          <div className="flex items-center gap-3 rounded-md border border-soft-green bg-white p-3.5">
            <Initials size={42}>I.M</Initials>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-black">Brother · 33 · Montreal</span>
              <span className="truncate text-[11px] text-text">
                14 messages · last Thursday
              </span>
            </div>
            <span className="rounded-pill border border-soft-green px-3 py-1.5 text-[11px] font-semibold text-black">
              Read
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
            Recent activity
          </span>
          {[
            ["You approved a conversation", "Tuesday, 20:15"],
            ["Fatima accepted a connection", "Tuesday, 14:02"],
            ["Connection request received", "Tuesday, 09:00"],
          ].map(([what, when]) => (
            <div key={what} className="flex items-center gap-2.5 border-b border-soft-green pb-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/20 text-accent-deep">
                <Check className="h-3 w-3" />
              </span>
              <span className="flex-1 text-[12px] text-black/80">{what}</span>
              <span className="text-[10px] text-text/60">{when}</span>
            </div>
          ))}
        </div>
      </div>

      <BottomNav active={1} />
      <HomeBar />
    </div>
  );
}
