/* The template pulled Font Awesome from three CDNs. These are inline
   stand-ins so the page ships no external requests and no icon-font FOUT.
   Each renders at 1em and inherits currentColor, matching how the
   original <i> tags behaved. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function Glyph({ children, viewBox = "0 0 512 512", ...rest }: P) {
  return (
    <svg
      viewBox={viewBox}
      fill="currentColor"
      aria-hidden
      focusable="false"
      width="1em"
      height="1em"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function Facebook(p: P) {
  return (
    <Glyph viewBox="0 0 320 512" {...p}>
      <path d="M80 192v64h48v208h96V256h63l8-64h-71v-38c0-17 4-25 27-25h44V64h-58c-69 0-109 29-109 100v28h-48z" />
    </Glyph>
  );
}

export function Twitter(p: P) {
  return (
    <Glyph {...p}>
      <path d="M459 152c.3 4.5.3 9 .3 13.5 0 138-105 297-297 297-64.7 0-124.8-18.8-175.3-51.3 9.2 1 18 1.4 27.4 1.4 53.4 0 102.6-18 141.9-48.7-50.2-1-92.3-34-106.8-79.3 7 1 14 1.7 21.4 1.7 10.2 0 20.5-1.4 30-3.9-52.4-10.6-91.7-56.6-91.7-112.2v-1.4c15.2 8.5 32.9 13.8 51.6 14.4-30.8-20.5-51-55.6-51-95.3 0-21.2 5.6-40.6 15.5-57.6C81 112.7 166.6 159 262.7 164c-1.8-8.5-2.8-17.3-2.8-26.2 0-63 51-114.3 114.3-114.3 32.9 0 62.6 13.8 83.5 36.1 25.8-4.9 50.5-14.4 72.4-27.4-8.5 26.6-26.6 48.9-50.2 63 23-2.5 45.3-8.9 65.8-17.7-15.5 22.6-34.9 42.7-57.1 58.9z" />
    </Glyph>
  );
}

export function Pinterest(p: P) {
  return (
    <Glyph viewBox="0 0 384 512" {...p}>
      <path d="M204 6C101 6 48 80 48 142c0 37 14 70 44 82 5 2 9 0 11-6l4-17c1-6 1-8-3-13-9-11-15-26-15-46 0-60 45-113 116-113 63 0 98 39 98 90 0 68-30 125-75 125-25 0-43-20-37-45 7-30 20-62 20-84 0-19-10-35-32-35-25 0-46 26-46 62 0 22 8 38 8 38l-31 131c-9 39-1 86-1 91 0 3 4 4 6 2 2-3 32-40 42-77l16-62c8 15 31 28 55 28 73 0 122-66 122-155C350 71 293 6 204 6z" />
    </Glyph>
  );
}

export function Instagram(p: P) {
  return (
    <Glyph viewBox="0 0 448 512" {...p}>
      <path d="M224 141a115 115 0 100 230 115 115 0 000-230zm0 190a75 75 0 110-150 75 75 0 010 150zm146-195a27 27 0 11-54 0 27 27 0 0154 0zm76 27c-2-36-10-68-36-94s-58-34-94-36c-37-2-149-2-186 0-36 2-67 10-94 36s-34 58-36 94c-2 37-2 149 0 186 2 36 10 68 36 94s58 34 94 36c37 2 149 2 186 0 36-2 68-10 94-36s34-58 36-94c2-37 2-148 0-186zm-48 226a76 76 0 01-43 43c-30 12-100 9-132 9s-102 3-132-9a76 76 0 01-43-43c-12-30-9-100-9-132s-3-102 9-132a76 76 0 0143-43c30-12 100-9 132-9s102-3 132 9a76 76 0 0143 43c12 30 9 100 9 132s3 102-9 132z" />
    </Glyph>
  );
}

export function LinkedIn(p: P) {
  return (
    <Glyph viewBox="0 0 448 512" {...p}>
      <path d="M100 448H7V148h93v300zM54 107a54 54 0 110-108 54 54 0 010 108zm394 341h-93V302c0-35-1-79-48-79-48 0-56 38-56 77v148h-93V148h89v41h1c13-23 43-48 88-48 94 0 111 62 111 142v165z" />
    </Glyph>
  );
}

/* The template used Font Awesome's `fa-solid fa-g` here — the letter, not
   the Google wordmark — so this draws a G rather than the brand glyph. */
export function GoogleG({ className = "", ...p }: P) {
  return (
    <span
      aria-hidden
      className={`font-jost text-[1.05em] font-bold leading-none ${className}`}
      {...(p as React.HTMLAttributes<HTMLSpanElement>)}
    >
      G
    </span>
  );
}

export function Search(p: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
      width="1em"
      height="1em"
      {...p}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  );
}

export function PhoneVolume(p: P) {
  return (
    <Glyph viewBox="0 0 384 512" {...p}>
      <path d="M97 26l64 96c7 11 5 25-5 33l-40 32c25 45 63 83 108 108l32-40c8-10 22-12 33-5l96 64c11 8 15 22 9 34l-32 64c-6 12-19 18-32 15C143 400 0 257 0 96 0 83 6 70 18 64L82 32c12-6 26-2 34 9l-19-15z" />
      <path d="M304 32a16 16 0 000 32 112 112 0 01112 112 16 16 0 0032 0A144 144 0 00304 32zm0 80a16 16 0 000 32 32 32 0 0132 32 16 16 0 0032 0 64 64 0 00-64-64z" />
    </Glyph>
  );
}

export function Envelope(p: P) {
  return (
    <Glyph {...p}>
      <path d="M48 64h416c26 0 48 22 48 48v16L256 277 0 128v-16c0-26 22-48 48-48zM0 176l244 142c7 4 17 4 24 0L512 176v224c0 26-22 48-48 48H48c-26 0-48-22-48-48V176z" />
    </Glyph>
  );
}

export function User(p: P) {
  return (
    <Glyph viewBox="0 0 448 512" {...p}>
      <path d="M224 256a128 128 0 100-256 128 128 0 000 256zm-45 48C80 304 0 384 0 483c0 16 13 29 29 29h390c16 0 29-13 29-29 0-99-80-179-179-179h-90z" />
    </Glyph>
  );
}

export function PeopleGroup(p: P) {
  return (
    <Glyph viewBox="0 0 640 512" {...p}>
      <path d="M96 128a64 64 0 11128 0 64 64 0 01-128 0zm320 0a64 64 0 11128 0 64 64 0 01-128 0zM0 358c0-46 37-84 83-84h42c13 0 25 3 35 8-1 6-1 12-1 18 0 30 13 57 34 76H26c-14 0-26-12-26-26zm447 18h-1c21-19 34-46 34-76 0-6 0-12-1-18 10-5 22-8 35-8h42c46 0 83 38 83 84 0 14-12 26-26 26H447zM256 128a64 64 0 11128 0 64 64 0 01-128 0zm-96 246c0-53 43-96 96-96h48c53 0 96 43 96 96 0 15-12 26-26 26H186c-14 0-26-11-26-26z" />
    </Glyph>
  );
}

export function MapPin(p: P) {
  return (
    <Glyph viewBox="0 0 384 512" {...p}>
      <path d="M192 0C86 0 0 86 0 192c0 87 28 113 156 297 17 25 55 25 72 0 128-184 156-210 156-297C384 86 298 0 192 0zm0 272a80 80 0 110-160 80 80 0 010 160z" />
    </Glyph>
  );
}

export function CalendarDays(p: P) {
  return (
    <Glyph viewBox="0 0 448 512" {...p}>
      <path d="M128 0c13 0 24 11 24 24v40h144V24c0-13 11-24 24-24s24 11 24 24v40h40c35 0 64 29 64 64v320c0 35-29 64-64 64H64c-35 0-64-29-64-64V128c0-35 29-64 64-64h40V24c0-13 11-24 24-24zM48 192v256c0 9 7 16 16 16h320c9 0 16-7 16-16V192H48zm48 48h64v48H96v-48zm112 0h64v48h-64v-48zm112 0h64v48h-64v-48zM96 336h64v48H96v-48zm112 0h64v48h-64v-48zm112 0h64v48h-64v-48z" />
    </Glyph>
  );
}

export function CaretRight(p: P) {
  return (
    <Glyph viewBox="0 0 256 512" {...p}>
      <path d="M64 448V64l160 192L64 448z" />
    </Glyph>
  );
}

export function ArrowLeft(p: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      width="1em"
      height="1em"
      {...p}
    >
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

export function ArrowRight(p: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      width="1em"
      height="1em"
      {...p}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function Play(p: P) {
  return (
    <Glyph viewBox="0 0 384 512" {...p}>
      <path d="M73 39c-15-9-33-9-48 0S0 65 0 83v346c0 18 10 35 25 44s33 9 48 0l288-173c15-9 24-25 24-42s-9-33-24-42L73 39z" />
    </Glyph>
  );
}

export function ClipboardList(p: P) {
  return (
    <Glyph viewBox="0 0 384 512" {...p}>
      <path d="M192 0c-31 0-57 22-63 51h-9c-31 0-56 25-56 56v13H48c-27 0-48 21-48 48v296c0 27 21 48 48 48h288c27 0 48-21 48-48V168c0-27-21-48-48-48h-16v-13c0-31-25-56-56-56h-9c-6-29-32-51-63-51zm0 64a19 19 0 110-38 19 19 0 010 38zM96 240a20 20 0 1140 0 20 20 0 01-40 0zm80-12h112a12 12 0 010 24H176a12 12 0 010-24zM96 320a20 20 0 1140 0 20 20 0 01-40 0zm80-12h112a12 12 0 010 24H176a12 12 0 010-24z" />
    </Glyph>
  );
}

export function Tick(p: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      width="1em"
      height="1em"
      {...p}
    >
      <circle cx="12" cy="12" r="9.5" strokeWidth="1.3" />
      <path d="M7.8 12.3l2.7 2.7 5.7-5.9" />
    </svg>
  );
}

/* Convenience map so data files can name an icon as a string. */
export const SOCIAL_ICONS = {
  facebook: Facebook,
  twitter: Twitter,
  pinterest: Pinterest,
  instagram: Instagram,
  linkedin: LinkedIn,
  google: GoogleG,
} as const;

export type SocialName = keyof typeof SOCIAL_ICONS;
