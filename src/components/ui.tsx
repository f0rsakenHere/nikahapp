import type { ReactNode } from "react";

/* ------------------------------------------------------------------
   Eyebrow — small caps label with a fading brass rule beneath it.
   Sits above every section title.
   ------------------------------------------------------------------ */
export function Eyebrow({
  children,
  onDark = false,
  center = false,
}: {
  children: ReactNode;
  onDark?: boolean;
  center?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 ${center ? "items-center" : "items-start"}`}>
      <span
        className={`text-eyebrow uppercase ${onDark ? "text-brass-soft" : "text-brass"}`}
      >
        {children}
      </span>
      <span className={`rule-fade h-px w-16 ${center ? "opacity-70" : ""}`} />
    </div>
  );
}

/* ------------------------------------------------------------------
   Button — pill, two weights, works on both grounds.
   ------------------------------------------------------------------ */
export function Button({
  href,
  children,
  variant = "solid",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "outline" | "onDark" | "outlineDark";
  className?: string;
}) {
  const styles = {
    solid: "bg-ink text-cream hover:bg-deep",
    outline: "border border-line bg-transparent text-ink hover:border-brass hover:text-brass",
    onDark: "bg-brass text-ink hover:bg-brass-soft",
    outlineDark: "border border-white/25 text-cream hover:border-brass-soft hover:text-brass-soft",
  } as const;

  return (
    <a
      href={href}
      className={`inline-flex h-[52px] items-center justify-center rounded-pill px-7 text-sm font-semibold transition-colors ${styles[variant]} ${className}`}
    >
      {children}
    </a>
  );
}

/* ------------------------------------------------------------------
   SectionHead — eyebrow + serif title + optional lead paragraph.
   ------------------------------------------------------------------ */
export function SectionHead({
  eyebrow,
  title,
  body,
  onDark = false,
  center = false,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  onDark?: boolean;
  center?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex max-w-[620px] flex-col gap-6 ${
        center ? "items-center text-center" : "items-start"
      } ${className}`}
    >
      {eyebrow ? (
        <Eyebrow onDark={onDark} center={center}>
          {eyebrow}
        </Eyebrow>
      ) : null}

      <h2
        className={`text-[32px] leading-[1.15] tracking-[-0.6px] md:text-d2 ${
          onDark ? "text-cream" : "text-ink"
        }`}
      >
        {title}
      </h2>

      {body ? (
        <p className={`text-lead ${onDark ? "text-body-dark" : "text-body"}`}>{body}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------
   Mark — an eight-point star inside an arch, used as the logo.
   ------------------------------------------------------------------ */
export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <path
        d="M4 30V15a12 12 0 0124 0v15z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <g stroke="currentColor" strokeWidth="1.3">
        <rect x="11" y="12" width="10" height="10" />
        <rect x="11" y="12" width="10" height="10" transform="rotate(45 16 17)" />
      </g>
    </svg>
  );
}

/* A small brass tick used in feature lists. */
export function Tick({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path
        d="M4 10.5l4 4 8-9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
