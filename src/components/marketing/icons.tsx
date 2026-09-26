/* The homepage's small pictograms.
 *
 * Drawn here rather than pulled from an icon set: there are nine of
 * them, they all want the same 1.6px stroke and the same 24px box, and a
 * dependency for nine paths is a dependency that will be at a different
 * version in a year. `currentColor` throughout, so a section decides the
 * colour and the icon never argues.
 */

type P = { className?: string };

const box = "h-6 w-6 shrink-0";
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function LeafIcon({ className = "" }: P) {
  /* A maple leaf, simplified to the silhouette it reads as at 24px. */
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${box} ${className}`}>
      <path
        d="M12 3l1.6 3.3 2.2-.7-.6 2.3 3.1-.5-1.5 2.4 1.2.9-4 2.2.6 2-3.3-.6.3 4.7h-1.2l.3-4.7-3.3.6.6-2-4-2.2 1.2-.9L3.7 7.4l3.1.5-.6-2.3 2.2.7L12 3z"
        fill="currentColor"
      />
    </svg>
  );
}

export function RingsIcon({ className = "" }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${box} ${className}`}>
      <circle cx="9" cy="14" r="5.2" {...stroke} />
      <circle cx="15" cy="14" r="5.2" {...stroke} />
      <path d="M13 4.6l2-1.6 2 1.6-2 2.2-2-2.2z" {...stroke} />
    </svg>
  );
}

export function PeopleIcon({ className = "" }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${box} ${className}`}>
      <circle cx="9" cy="8.2" r="3" {...stroke} />
      <path d="M3.4 19.2c.5-3 2.8-4.7 5.6-4.7s5.1 1.7 5.6 4.7" {...stroke} />
      <circle cx="17.4" cy="9.4" r="2.3" {...stroke} />
      <path d="M16 14.8c2.4-.3 4.2 1.2 4.6 4.4" {...stroke} />
    </svg>
  );
}

export function HeartIcon({ className = "" }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${box} ${className}`}>
      <path
        d="M12 20.2l-7.1-6.6a4.3 4.3 0 016.1-6l1 1 1-1a4.3 4.3 0 016.1 6L12 20.2z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ShieldIcon({ className = "" }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${box} ${className}`}>
      <path d="M12 3l7 2.6v5.6c0 4.2-2.8 7.7-7 9.2-4.2-1.5-7-5-7-9.2V5.6L12 3z" {...stroke} />
      <path d="M9.2 12.1l2 2 3.6-3.9" {...stroke} />
    </svg>
  );
}

export function ProfileCardIcon({ className = "" }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${box} ${className}`}>
      <rect x="3.2" y="4.4" width="17.6" height="15.2" rx="2.4" {...stroke} />
      <circle cx="9.4" cy="10.2" r="2.1" {...stroke} />
      <path d="M6 16.4c.4-1.7 1.8-2.6 3.4-2.6s3 .9 3.4 2.6M15.2 9.4h3.1M15.2 12.6h3.1" {...stroke} />
    </svg>
  );
}

export function SearchIcon({ className = "" }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${box} ${className}`}>
      <circle cx="10.8" cy="10.8" r="6.2" {...stroke} />
      <path d="M15.4 15.4l4.2 4.2" {...stroke} />
    </svg>
  );
}

export function ConnectIcon({ className = "" }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${box} ${className}`}>
      <path d="M12 8.6l-.8-.8a2.6 2.6 0 10-3.7 3.7l4.5 4.4 4.5-4.4a2.6 2.6 0 10-3.7-3.7l-.8.8z" {...stroke} />
      <path d="M4.6 20.4c.4-1.8 1.7-2.8 3.3-2.8M16.1 17.6c1.6 0 2.9 1 3.3 2.8" {...stroke} />
    </svg>
  );
}

export function ArrowIcon({ className = "" }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${box} ${className}`}>
      <path d="M4.5 12h14M13.4 6.6L18.8 12l-5.4 5.4" {...stroke} />
    </svg>
  );
}

export const ICONS = {
  leaf: LeafIcon,
  rings: RingsIcon,
  people: PeopleIcon,
  heart: HeartIcon,
  shield: ShieldIcon,
  profile: ProfileCardIcon,
  search: SearchIcon,
  connect: ConnectIcon,
} as const;

export type IconName = keyof typeof ICONS;
