/* Icons for the member app.
 *
 * Deliberately a different set from `bridely/primitives/Icons`, which
 * are filled Font Awesome stand-ins carried over with the marketing
 * template. These are stroked and drawn on a 24 grid, because they are
 * used at 16–22px next to running text where a filled glyph turns into
 * a blob. Same contract as the other set: 1em, `currentColor`,
 * decorative by default.
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Stroke({ children, ...rest }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M3.5 10.2 12 3.8l8.5 6.4V20a1 1 0 0 1-1 1h-4.6v-6H9.1v6H4.5a1 1 0 0 1-1-1z" />
    </Stroke>
  );
}

export function BrowseIcon(p: P) {
  return (
    <Stroke {...p}>
      <circle cx="11" cy="11" r="6.4" />
      <path d="m20.5 20.5-4.6-4.6" />
    </Stroke>
  );
}

export function RequestsIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M3.2 7.6 12 13l8.8-5.4" />
      <rect x="3.2" y="4.8" width="17.6" height="14.4" rx="2" />
    </Stroke>
  );
}

export function ProfileIcon(p: P) {
  return (
    <Stroke {...p}>
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M4.8 20c.6-3.8 3.6-6 7.2-6s6.6 2.2 7.2 6" />
    </Stroke>
  );
}

export function ChatIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M20.5 12.4c0 3.9-3.8 7-8.5 7a9.7 9.7 0 0 1-2.6-.35L4.2 20.6l1.3-3.5A6.6 6.6 0 0 1 3.5 12.4c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7Z" />
    </Stroke>
  );
}

export function SentIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M20.8 3.6 3.9 10.3l6.4 2.6 2.6 6.4z" />
      <path d="M10.3 12.9 20.8 3.6" />
    </Stroke>
  );
}

export function SparkIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M12 3.4 13.9 9l5.6 1.9-5.6 1.9L12 18.4 10.1 12.8 4.5 10.9 10.1 9z" />
    </Stroke>
  );
}

export function ShieldIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M12 3.2 5 5.8v5.6c0 4 2.9 7.6 7 9.4 4.1-1.8 7-5.4 7-9.4V5.8z" />
      <path d="m9.1 11.9 2.1 2.1 3.9-4" />
    </Stroke>
  );
}

export function ClockIcon(p: P) {
  return (
    <Stroke {...p}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4v4.9l3.1 1.9" />
    </Stroke>
  );
}

export function WaliIcon(p: P) {
  return (
    <Stroke {...p}>
      <circle cx="9" cy="8.4" r="3.2" />
      <path d="M2.8 19.4c.5-3.3 3.1-5.2 6.2-5.2s5.7 1.9 6.2 5.2" />
      <path d="M16.4 5.6a3.2 3.2 0 0 1 0 5.9M18.1 14.6c1.8.7 3 2.3 3.3 4.4" />
    </Stroke>
  );
}

export function AccountIcon(p: P) {
  return (
    <Stroke {...p}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.6 14.3a1.5 1.5 0 0 0 .3 1.7l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.5 1.5 0 0 0-2.6 1.1v.3a1.9 1.9 0 1 1-3.8 0v-.2a1.5 1.5 0 0 0-2.6-1.1l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.5 1.5 0 0 0-1.1-2.6h-.3a1.9 1.9 0 1 1 0-3.8h.2a1.5 1.5 0 0 0 1.1-2.6l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.5 1.5 0 0 0 2.6-1.1v-.3a1.9 1.9 0 1 1 3.8 0v.2a1.5 1.5 0 0 0 2.6 1.1l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.5 1.5 0 0 0 1.1 2.6h.3a1.9 1.9 0 1 1 0 3.8h-.2a1.5 1.5 0 0 0-1.4.9Z" />
    </Stroke>
  );
}

export function MapPinIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M12 21c4.2-4.4 6.3-7.7 6.3-10.4A6.3 6.3 0 0 0 5.7 10.6C5.7 13.3 7.8 16.6 12 21Z" />
      <circle cx="12" cy="10.4" r="2.4" />
    </Stroke>
  );
}

export function WorkIcon(p: P) {
  return (
    <Stroke {...p}>
      <rect x="3.2" y="7.4" width="17.6" height="12.4" rx="2" />
      <path d="M8.8 7.4V5.8a1.6 1.6 0 0 1 1.6-1.6h3.2a1.6 1.6 0 0 1 1.6 1.6v1.6" />
      <path d="M3.2 12.6h17.6" />
    </Stroke>
  );
}

export function PrayerIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M19.4 15.3A7.6 7.6 0 0 1 9.1 4.8a8.4 8.4 0 1 0 10.3 10.5Z" />
    </Stroke>
  );
}

export function BookIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M4 5.2A1.6 1.6 0 0 1 5.6 3.6H19a.8.8 0 0 1 .8.8v13.4a.8.8 0 0 1-.8.8H5.6A1.6 1.6 0 0 0 4 20.2z" />
      <path d="M4 16.8h15.8" />
    </Stroke>
  );
}

export function RingsIcon(p: P) {
  return (
    <Stroke {...p}>
      <circle cx="9.2" cy="14.4" r="5" />
      <circle cx="15.4" cy="10.6" r="5" />
    </Stroke>
  );
}

export function SchoolIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M2.8 9 12 4.6 21.2 9 12 13.4z" />
      <path d="M6.6 11v4.6c0 1.6 2.4 2.8 5.4 2.8s5.4-1.2 5.4-2.8V11" />
    </Stroke>
  );
}

export function SpeechIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M3.6 12.4a8.4 8.4 0 1 1 3.5 6.8l-3.5 1.1 1.1-3.4a8.3 8.3 0 0 1-1.1-4.5Z" />
      <path d="M8.4 10.4h7.2M8.4 14h4.8" />
    </Stroke>
  );
}

export function HeightIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M12 3.4v17.2" />
      <path d="m8.6 6.4 3.4-3 3.4 3M8.6 17.6l3.4 3 3.4-3" />
    </Stroke>
  );
}

export function HeartIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M12 20.4C6.8 17 3.6 13.9 3.6 10.3a4.3 4.3 0 0 1 8.4-1.4 4.3 4.3 0 0 1 8.4 1.4c0 3.6-3.2 6.7-8.4 10.1Z" />
    </Stroke>
  );
}

export function PassIcon(p: P) {
  return (
    <Stroke {...p}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="m8.6 8.6 6.8 6.8" />
    </Stroke>
  );
}

export function BellIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M18.2 16.4H5.8l1.3-2.2v-4a4.9 4.9 0 0 1 9.8 0v4z" />
      <path d="M10.2 19.4a2 2 0 0 0 3.6 0" />
    </Stroke>
  );
}

export function SparkleIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="M12 3.6 13.6 8 18 9.6 13.6 11.2 12 15.6 10.4 11.2 6 9.6 10.4 8z" />
      <path d="M18.4 15.2 19.2 17.4l2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </Stroke>
  );
}

export function CheckIcon(p: P) {
  return (
    <Stroke {...p}>
      <path d="m5 12.6 4.4 4.4L19 7.4" />
    </Stroke>
  );
}

export function ChevronRight(p: P) {
  return (
    <Stroke {...p}>
      <path d="m9.5 5.5 6.4 6.5-6.4 6.5" />
    </Stroke>
  );
}
