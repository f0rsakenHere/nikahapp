import { AppBar, BottomNav, Btn, Check, Chip, Initials, Lock } from "@/components/app/kit";
import { HomeBar } from "@/components/app/Phone";

const QUEUE = [
  {
    initials: "Y.K",
    who: "Brother · 29",
    where: "Toronto, ON",
    work: "Software engineer",
    tags: ["Five daily", "Hanafi", "Never married"],
    isNew: true,
  },
  {
    initials: "I.M",
    who: "Brother · 33",
    where: "Montreal, QC",
    work: "Dentist",
    tags: ["Five daily", "Maliki", "Divorced"],
    isNew: true,
  },
  {
    initials: "A.S",
    who: "Brother · 27",
    where: "Ottawa, ON",
    work: "Teacher",
    tags: ["Five daily", "Shafi'i", "Never married"],
    isNew: false,
  },
];

/* 4 — Browsing the pool. Looking is free; asking to talk is what is
   scarce, so the count on the right is connections remaining rather than
   a monthly allowance of referrals.

   PLACEHOLDER: "7 connections left" is illustrative. How many a member
   gets, whether they are granted or bought, and whether an unanswered
   request is refunded are all undecided — APP-PLAN §3.1. */
export function Browse() {
  return (
    <div className="flex h-full flex-col">
      <AppBar
        title="Browse members"
        sub="Every member here is verified. Nobody outside the service can see them."
      />

      <div className="flex items-center justify-between px-6 pb-3">
        <Chip tone="peach">New this week</Chip>
        <span className="text-[11px] text-text/70">7 connections left</span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden px-6">
        {QUEUE.map((p) => (
          <div
            key={p.initials}
            className="flex gap-3.5 rounded-md border border-soft-green bg-white p-3.5"
          >
            <Initials size={52}>{p.initials}</Initials>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-black">{p.who}</span>
                {p.isNew ? <Chip tone="peach">New</Chip> : null}
              </div>
              <span className="text-[12px] text-text">
                {p.where} · {p.work}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
            </div>
          </div>
        ))}

        <p className="mt-1 flex items-start gap-2 text-[11px] leading-[16px] text-text/70">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Photographs are not shown here. They are exchanged only after a connection is accepted
          and your wali approves.
        </p>
      </div>

      <BottomNav active={0} />
    </div>
  );
}

/* 5 — Profile detail. The photograph slot is present but locked, which
   states the rule far better than a line of policy text would. */
export function ProfileDetail() {
  return (
    <div className="flex h-full flex-col pb-10">
      <AppBar back title="Brother · 29" sub="Toronto, Ontario" />

      {/* `shrink-0` on all three blocks, deliberately. Without it they are
          flex items in an `overflow-hidden` column, so when the screen runs
          long they do not overflow — they compress, silently, and the
          verified badge at the bottom disappears while every bounding box
          stays inside the frame and scripts/measure.cjs reports a pass.
          scripts/squash.cjs is the check for that failure mode. */}
      <div className="flex flex-1 flex-col gap-3 overflow-hidden px-6">
        {/* The empty photo slot takes the same two-cornered picture shape as
            the Initials tile, so it reads as a frame with nothing in it. */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-br-[30px] rounded-tl-[30px] border border-dashed border-soft-green bg-mist py-4 text-center">
          <Lock className="h-5 w-5 text-peach-deep" />
          <span className="text-[12px] font-semibold text-black">Photograph locked</span>
          <span className="max-w-[220px] text-[11px] leading-[15px] text-text">
            Shared once he accepts your connection, and only after your wali approves.
          </span>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {[
            ["Education", "MSc Computer Science, McGill"],
            ["Work", "Software engineer"],
            ["Salah", "Five daily, at the masjid where he can"],
            ["Madhhab", "Hanafi"],
            ["Family", "Born in Toronto, parents from Lahore"],
            ["Looking for", "A practising sister settled in Canada"],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 border-b border-soft-green pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.6px] text-text/60">
                {k}
              </span>
              <span className="text-[13px] leading-[19px] text-black">{v}</span>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-md bg-accent/12 px-3 py-2.5">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/25 text-accent-deep">
            <Check className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] leading-[15px] text-black/75">
            Identity verified · Reference confirmed with his local imam
          </span>
        </div>
      </div>

      <div className="flex gap-3 px-6 pt-4">
        <Btn variant="danger" className="flex-1">
          Not for me
        </Btn>
        <Btn className="flex-[1.4]">Connect · uses 1</Btn>
      </div>

      <HomeBar />
    </div>
  );
}

/* 6 — A connection accepted. The conversation does not open here: it
   waits on the wali, and the screen says so plainly rather than hiding
   it. Browsing changed who initiates; it did not change this gate. */
export function MutualInterest() {
  const timeline = [
    { label: "You sent a connection", meta: "Tuesday, 14:02", done: true },
    { label: "He accepted", meta: "Tuesday, 19:41", done: true },
    { label: "Awaiting your wali's approval", meta: "Ahmed Al-Rashid · notified", done: false },
    { label: "Conversation opens", meta: "Once approved", done: false },
  ];

  return (
    <div className="flex h-full flex-col pb-10">
      <AppBar back title="Connection accepted" />

      <div className="flex flex-1 flex-col gap-6 px-6">
        <div className="flex flex-col items-center gap-3 rounded-md bg-soft-peach/60 p-6 text-center">
          <div className="flex items-center gap-2">
            <Initials size={44}>F.A</Initials>
            <span className="text-peach-deep">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <Initials size={44}>Y.K</Initials>
          </div>
          <span className="font-playfair text-[19px] font-bold text-black">He accepted your connection</span>
          <span className="text-[12px] leading-[17px] text-text">
            Nothing is shared yet. Your name and contact details stay private.
          </span>
        </div>

        <ol className="flex flex-col">
          {timeline.map((t, i) => (
            <li key={t.label} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    t.done ? "bg-peach text-black" : "border border-dashed border-soft-green bg-white text-text/40"
                  }`}
                >
                  {t.done ? <Check className="h-3.5 w-3.5" /> : <span className="text-[11px]">{i + 1}</span>}
                </span>
                {i < timeline.length - 1 ? <span className="h-9 w-px bg-soft-green" /> : null}
              </div>
              <div className="flex flex-col pb-1">
                <span className={`text-[13px] font-semibold ${t.done ? "text-black" : "text-text"}`}>
                  {t.label}
                </span>
                <span className="text-[11px] text-text/70">{t.meta}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-2.5 px-6">
        <Btn variant="danger">Waiting for approval</Btn>
        <p className="text-center text-[11px] leading-[15px] text-text/70">
          You cannot message before your wali approves. He was notified at 19:41.
        </p>
      </div>

      <HomeBar />
    </div>
  );
}
