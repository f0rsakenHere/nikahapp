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

/* 4 — Introductions. A queue that is sent to you, not a feed you scroll:
   no search, no filters, and a visible count of what is left this month. */
export function Introductions() {
  return (
    <div className="flex h-full flex-col">
      <AppBar
        title="Your introductions"
        sub="Curated and sent to you. There is no search, and no one can find you."
      />

      <div className="flex items-center justify-between px-6 pb-3">
        <Chip tone="brass">2 new</Chip>
        <span className="text-[11px] text-body/70">3 of 5 remaining this month</span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden px-6">
        {QUEUE.map((p) => (
          <div
            key={p.initials}
            className="flex gap-3.5 rounded-md border border-line bg-white p-3.5"
          >
            <Initials size={52}>{p.initials}</Initials>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-ink">{p.who}</span>
                {p.isNew ? <Chip tone="brass">New</Chip> : null}
              </div>
              <span className="text-[12px] text-body">
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

        <p className="mt-1 flex items-start gap-2 text-[11px] leading-[16px] text-body/70">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Photographs are not shown here. They are exchanged only after mutual interest and your
          wali&apos;s approval.
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

      <div className="flex flex-1 flex-col gap-3.5 overflow-hidden px-6">
        <div className="arch-sm flex flex-col items-center justify-center gap-1.5 border border-dashed border-line bg-shell py-6 text-center">
          <Lock className="h-6 w-6 text-brass" />
          <span className="text-[12px] font-semibold text-ink">Photograph locked</span>
          <span className="max-w-[220px] text-[11px] leading-[15px] text-body">
            Shared after mutual interest, and only once your wali approves.
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {[
            ["Education", "MSc Computer Science, McGill"],
            ["Work", "Software engineer"],
            ["Salah", "Five daily, at the masjid where he can"],
            ["Madhhab", "Hanafi"],
            ["Family", "Born in Toronto, parents from Lahore"],
            ["Looking for", "A practising sister settled in Canada"],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 border-b border-line pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.6px] text-body/60">
                {k}
              </span>
              <span className="text-[13px] leading-[19px] text-ink">{v}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-md bg-sage/12 px-3 py-2.5">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sage/25 text-sage">
            <Check className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] leading-[15px] text-ink/75">
            Identity verified · Reference confirmed with his local imam
          </span>
        </div>
      </div>

      <div className="flex gap-3 px-6 pt-4">
        <Btn variant="danger" className="flex-1">
          Not for me
        </Btn>
        <Btn className="flex-[1.4]">Express interest</Btn>
      </div>

      <HomeBar />
    </div>
  );
}

/* 6 — Mutual interest. The conversation does not open here: it waits on
   the wali, and the screen says so plainly rather than hiding it. */
export function MutualInterest() {
  const timeline = [
    { label: "You expressed interest", meta: "Tuesday, 14:02", done: true },
    { label: "He expressed interest", meta: "Tuesday, 19:41", done: true },
    { label: "Awaiting your wali's approval", meta: "Ahmed Al-Rashid · notified", done: false },
    { label: "Conversation opens", meta: "Once approved", done: false },
  ];

  return (
    <div className="flex h-full flex-col pb-10">
      <AppBar back title="Mutual interest" />

      <div className="flex flex-1 flex-col gap-6 px-6">
        <div className="flex flex-col items-center gap-3 rounded-md bg-brass-tint/60 p-6 text-center">
          <div className="flex items-center gap-2">
            <Initials size={44}>F.A</Initials>
            <span className="text-brass">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <Initials size={44}>Y.K</Initials>
          </div>
          <span className="font-display text-[19px] text-ink">You are both interested</span>
          <span className="text-[12px] leading-[17px] text-body">
            Nothing is shared yet. Your name and contact details stay private.
          </span>
        </div>

        <ol className="flex flex-col">
          {timeline.map((t, i) => (
            <li key={t.label} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    t.done ? "bg-brass text-ink" : "border border-dashed border-line bg-white text-body/40"
                  }`}
                >
                  {t.done ? <Check className="h-3.5 w-3.5" /> : <span className="text-[11px]">{i + 1}</span>}
                </span>
                {i < timeline.length - 1 ? <span className="h-9 w-px bg-line" /> : null}
              </div>
              <div className="flex flex-col pb-1">
                <span className={`text-[13px] font-semibold ${t.done ? "text-ink" : "text-body"}`}>
                  {t.label}
                </span>
                <span className="text-[11px] text-body/70">{t.meta}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-2.5 px-6">
        <Btn variant="danger">Waiting for approval</Btn>
        <p className="text-center text-[11px] leading-[15px] text-body/70">
          You cannot message before your wali approves. He was notified at 19:41.
        </p>
      </div>

      <HomeBar />
    </div>
  );
}
