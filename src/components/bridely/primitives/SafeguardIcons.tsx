/* Line icons for the four safeguard tiles.

   The template shipped a guitar, a dining table, a curtain and a gift box
   for its "Entertainment / Dining / Decor / Swag" tiles. Those read badly
   against "A wali throughout" and "No direct contact" — and the music and
   party imagery is a poor fit for the service besides. These are drawn in
   the same thin-stroke style, with the same peach heart accent, so the
   block still looks like part of the template. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Frame({ children, ...rest }: P) {
  return (
    <svg
      viewBox="0 0 120 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/* Sparkles the template scattered around each of its icons. */
function Sparks() {
  return (
    <g className="text-accent/45" stroke="currentColor" strokeWidth="1.3">
      <circle cx="14" cy="20" r="2.4" />
      <circle cx="106" cy="26" r="1.8" />
      <circle cx="20" cy="76" r="1.8" />
      <path d="M100 70l2.6 2.6M102.6 70L100 72.6" />
    </g>
  );
}

/* A guardian standing with the pair — the wali present throughout. */
export function WaliIcon(p: P) {
  return (
    <Frame {...p}>
      <Sparks />
      <path d="M60 14l22 9v18c0 15-9.5 27-22 32-12.5-5-22-17-22-32V23l22-9z" className="text-accent" />
      <circle cx="60" cy="40" r="7" className="text-accent" />
      <path d="M47 62c2.5-7.5 7.3-11 13-11s10.5 3.5 13 11" className="text-accent" />
      <path
        d="M60 78.5c-3.6-3.2-6-5.1-6-7.6a3.1 3.1 0 016-1.4 3.1 3.1 0 016 1.4c0 2.5-2.4 4.4-6 7.6z"
        className="fill-peach text-peach"
      />
    </Frame>
  );
}

/* Two conversations that never join — nothing passes directly. */
export function NoContactIcon(p: P) {
  return (
    <Frame {...p}>
      <Sparks />
      <path d="M30 26h26a5 5 0 015 5v14a5 5 0 01-5 5H41l-8 7v-7h-3a5 5 0 01-5-5V31a5 5 0 015-5z" className="text-accent" />
      <path d="M64 44h26a5 5 0 015 5v14a5 5 0 01-5 5h-3v7l-8-7H64a5 5 0 01-5-5V49a5 5 0 015-5z" className="text-accent" />
      <path d="M44 68L76 30" className="text-peach" strokeWidth="2.4" />
    </Frame>
  );
}

/* A photograph released only once both sides agree. */
export function ConsentIcon(p: P) {
  return (
    <Frame {...p}>
      <Sparks />
      <rect x="30" y="24" width="60" height="46" rx="6" className="text-accent" />
      <circle cx="46" cy="39" r="5" className="text-accent" />
      <path d="M32 62l17-16 12 11 10-8 17 15" className="text-accent" />
      <circle cx="84" cy="66" r="12" className="fill-white text-peach" strokeWidth="2" />
      <path d="M78.5 66l3.8 3.8 7.2-7.4" className="text-peach" strokeWidth="2.2" />
    </Frame>
  );
}

/* A name card kept sealed until the final step. */
export function NameLastIcon(p: P) {
  return (
    <Frame {...p}>
      <Sparks />
      <rect x="28" y="34" width="64" height="42" rx="6" className="text-accent" />
      <path d="M28 40l32 21 32-21" className="text-accent" />
      <path d="M52 34v-8a8 8 0 0116 0v8" className="text-peach" strokeWidth="2.2" />
      <path
        d="M60 62.5c-3.6-3.2-6-5.1-6-7.6a3.1 3.1 0 016-1.4 3.1 3.1 0 016 1.4c0 2.5-2.4 4.4-6 7.6z"
        className="fill-peach text-peach"
      />
    </Frame>
  );
}

export const SAFEGUARD_ICONS = {
  wali: WaliIcon,
  contact: NoContactIcon,
  consent: ConsentIcon,
  names: NameLastIcon,
} as const;

export type SafeguardIconName = keyof typeof SAFEGUARD_ICONS;
