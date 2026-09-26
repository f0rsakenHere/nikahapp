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
        d="m12 1 2 4 2-1-1 6 4-4 1 3 3-1-1 6 2 1-9 5 .5 2H13v3h-2v-3H8.5l.5-2-9-5 2-1-1-6 3 1 1-3 4 4-1-6 2 1Z"
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
      <g fill="currentColor">
        <circle cx="12" cy="6.5" r="3" /><circle cx="4.5" cy="9" r="2.5" /><circle cx="19.5" cy="9" r="2.5" />
        <path d="M7.5 21v-6a4.5 4.5 0 0 1 9 0v6ZM1 20v-5a3.5 3.5 0 0 1 5.6-2.8 7 7 0 0 0-.6 2.8v5ZM18 20v-5a7 7 0 0 0-.6-2.8A3.5 3.5 0 0 1 23 15v5Z" />
      </g>
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
      <path d="M12 2l9 3v6c0 5-3.6 9-9 12-5.4-3-9-7-9-12V5Z" fill="currentColor" />
      <path d="m12 7 1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5Z" fill="#f4f8f2" />
    </svg>
  );
}

export function ProfileCardIcon({ className = "" }: P) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${box} ${className}`}>
      <rect x="2" y="1.5" width="17" height="21" rx="2.4" fill="none" stroke="currentColor" strokeWidth=".65" />
      <circle cx="8" cy="6.5" r="1.7" fill="currentColor" />
      <path d="M5.4 12.5V11a2.6 2.6 0 0 1 5.2 0v1.5Z" fill="currentColor" />
      <path d="M12.5 7h4M12.5 10h4M5.5 15.5h8M5.5 18.5h6" fill="none" stroke="currentColor" strokeWidth=".5" />
      <path d="m16 16 5-5q.8-.8 1.6 0l.4.4q.8.8 0 1.6l-5 5-3 1Z" fill="currentColor" stroke="#fff7f2" strokeWidth=".5" />
      <path d="m20 12 2 2M16 16l2 2" stroke="#fff7f2" strokeWidth=".5" />
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
      <g fill="currentColor">
        <path d="m12 9-4-4a2.6 2.6 0 0 1 4-3 2.6 2.6 0 0 1 4 3Z" />
        <circle cx="4.5" cy="11.5" r="2.8" /><circle cx="19.5" cy="11.5" r="2.8" />
        <path d="M.3 22v-3a4.2 4.2 0 0 1 8.4 0v3ZM15.3 22v-3a4.2 4.2 0 0 1 8.4 0v3Z" />
      </g>
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

export function ProfileIcon({ className = "" }: P) {
  return <svg viewBox="0 0 24 24" className={`${box} ${className}`} aria-hidden="true"><circle cx="12" cy="6" r="4" fill="currentColor" /><path d="M4 22v-3a8 8 0 0 1 16 0v3Z" fill="currentColor" /></svg>;
}

export function ChevronIcon({ className = "" }: P) {
  return <svg viewBox="0 0 24 24" className={`${box} ${className}`} aria-hidden="true"><path d="m9 5 7 7-7 7" {...stroke} /></svg>;
}

export function MosqueIcon({ className = "" }: P) {
  return <svg viewBox="0 0 24 24" className={`${box} ${className}`} aria-hidden="true"><path d="M11.5 1h1v4c1 3 6 4 6 8v2h-13v-2c0-4 5-5 6-8ZM4 13h2v9H3V11h1ZM18 13h2v-2h1v11h-3ZM6 16h12v6h-4v-4a2 2 0 0 0-4 0v4H6Z" fill="currentColor" /></svg>;
}

export const ICONS = {
  leaf: LeafIcon,
  rings: RingsIcon,
  mosque: MosqueIcon,
  people: PeopleIcon,
  heart: HeartIcon,
  shield: ShieldIcon,
  profile: ProfileCardIcon,
  search: SearchIcon,
  connect: ConnectIcon,
} as const;

export type IconName = keyof typeof ICONS;
