import type { ReactNode } from "react";

/* ------------------------------------------------------------------
   Small in-app primitives. Same palette and faces as the marketing
   site — mint for state and structure, peach for the single action on
   a screen — but tighter, and Playfair is reserved for screen titles.

   One rule runs through all of it, and it is not the obvious one:
   BOTH brand colours are tints, not text colours. Mint is 1.77:1 on
   white and 1.77:1 under white; peach is 1.99:1 either way. So a label
   is never set in mint or peach, and never reversed out of them:

     - text on a mint or peach FILL  -> near-black (10.5:1 / 9.4:1)
     - mint or peach TYPE on white   -> the -deep variants

   Verify with `node scripts/contrast.cjs` after touching any of this.
   ------------------------------------------------------------------ */

export function AppBar({
  title,
  back = false,
  action,
  sub,
}: {
  title: string;
  back?: boolean;
  action?: ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-6 pb-4 pt-2">
      {back ? (
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-soft-green text-black">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <h3 className="font-playfair text-[24px] font-bold leading-tight text-black">{title}</h3>
        {sub ? <p className="mt-1 text-[13px] leading-[18px] text-text">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex flex-col gap-2 px-6 pb-4">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[1px] text-text/70">
        <span>
          Step {step} of {total}
        </span>
        <span className="text-peach-deep">{Math.round((step / total) * 100)}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-soft-green">
        <div className="h-full rounded-full bg-peach" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
  placeholder,
  hint,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">{label}</span>
      <span
        className={`flex h-12 items-center rounded-md border border-soft-green bg-white px-3.5 text-[15px] ${
          value ? "text-black" : "text-text/45"
        }`}
      >
        {value ?? placeholder}
      </span>
      {hint ? <span className="text-[11px] leading-[15px] text-text/70">{hint}</span> : null}
    </label>
  );
}

export function Segmented({ options, active }: { options: string[]; active: number }) {
  return (
    <div className="flex gap-1 rounded-pill bg-soft-green/60 p-1">
      {options.map((o, i) => (
        <span
          key={o}
          className={`flex-1 rounded-pill py-2 text-center text-[13px] font-semibold ${
            i === active ? "bg-accent text-black" : "text-text"
          }`}
        >
          {o}
        </span>
      ))}
    </div>
  );
}

export function Chip({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  /* `selected` is the chosen option in a multiple-choice row, so it takes
     the same mint fill the segmented control uses for its active cell. */
  tone?: "plain" | "peach" | "accent" | "selected";
}) {
  const tones = {
    plain: "bg-soft-green/50 text-text",
    peach: "bg-soft-peach text-peach-deep",
    accent: "bg-accent/15 text-accent-deep",
    selected: "bg-accent text-black",
  } as const;

  return (
    <span className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Btn({
  children,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  /* Peach fill for the one action a screen is asking for, mint hairline
     for the alternative — the same pairing as PillButton on the site,
     but NOT the same foregrounds. PillButton reverses its labels out in
     white, which is 1.99:1 on peach and 1.77:1 on mint; copied here that
     turned a 9.4:1 button into a 2:1 one. Dark on the fill, deep mint on
     the hairline. */
  const v = {
    primary: "bg-peach text-black",
    ghost: "border-2 border-accent-deep text-accent-deep",
    danger: "border-2 border-soft-green text-text",
  } as const;

  return (
    <span
      className={`flex h-12 items-center justify-center rounded-pill text-[14px] font-semibold ${v[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

/* Initials tile, used everywhere a photograph would normally appear.

   Takes the site's picture shape — two opposite corners rounded hard, two
   left square — so the slot where a photo would go is recognisably the
   same frame the marketing photography sits in. The radius scales with the
   tile so a 38px avatar and a 52px one read as the same object. */
export function Initials({ children, size = 48 }: { children: ReactNode; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center bg-soft-peach font-playfair font-bold text-peach-deep"
      style={{
        width: size,
        height: size * 1.12,
        fontSize: size * 0.36,
        borderRadius: `${size * 0.34}px 0 ${size * 0.34}px 0`,
      }}
    >
      {children}
    </span>
  );
}

/* The persistent wali notice. Deliberately loud — this is the product.

   Mint on white, which is the site's own announcement bar: the strip above
   the header carries the Montreal line in exactly this pairing. */
export function WaliBanner({ name, variant = "solid" }: { name: string; variant?: "solid" | "soft" }) {
  const solid = variant === "solid";
  return (
    <div
      className={`flex items-center gap-2.5 px-6 py-2.5 ${
        solid ? "bg-accent text-black" : "bg-soft-peach text-peach-deep"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
        <circle cx="12" cy="12" r="2.6" />
      </svg>
      <span className="text-[12px] leading-[16px]">
        <strong className="font-semibold">{name}</strong> can read every message in this conversation
      </span>
    </div>
  );
}

export function BottomNav({ active }: { active: 0 | 1 | 2 }) {
  const tabs = [
    {
      label: "Browse",
      icon: (
        <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
      ),
    },
    {
      label: "Messages",
      icon: <path d="M4 6h16v11H9l-5 4V6z" strokeLinejoin="round" />,
    },
    {
      label: "Profile",
      icon: (
        <>
          <circle cx="12" cy="8.5" r="3.4" />
          <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" strokeLinecap="round" />
        </>
      ),
    },
  ];

  return (
    <div className="absolute inset-x-0 bottom-0 border-t border-soft-green bg-white/95 pb-5 pt-2 backdrop-blur">
      <div className="flex">
        {tabs.map((t, i) => (
          <span
            key={t.label}
            className={`flex flex-1 flex-col items-center gap-1 ${
              i === active ? "text-peach-deep" : "text-text/50"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              {t.icon}
            </svg>
            <span className="text-[10px] font-semibold">{t.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Lock({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="10" width="16" height="10" rx="2.5" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </svg>
  );
}

export function Check({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
