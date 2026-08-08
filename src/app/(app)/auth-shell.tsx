import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/bridely/primitives/Wordmark";

/* The frame around sign-up and sign-in.
 *
 * Deliberately narrow and centred rather than reusing the marketing
 * header: someone who has come here to register does not need the nav,
 * the dropdown and a second Register Now button competing with the form
 * they are already looking at. The wordmark links home, which is enough. */
export function AuthShell({
  title,
  blurb,
  children,
  footer,
}: {
  title: string;
  blurb: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-mist px-5 py-10 sm:py-16">
      <Link href="/" className="rounded-sm" aria-label="NikahCanada — home">
        {/* not leading-none: Playfair's line box is taller than 1em and
            the wordmark loses its descender to the clip */}
        <Wordmark className="text-[24px] leading-[1.3]" />
      </Link>

      <div className="mt-8 w-full max-w-[440px] rounded-lg border border-soft-green bg-white p-6 sm:p-8">
        <h1 className="font-playfair text-[28px] font-bold leading-tight text-black">{title}</h1>
        <p className="mt-2 text-[13px] leading-[19px] text-text">{blurb}</p>
        <div className="mt-7">{children}</div>
      </div>

      {footer ? (
        <p className="mt-6 text-center text-[13px] text-text">{footer}</p>
      ) : null}
    </main>
  );
}
