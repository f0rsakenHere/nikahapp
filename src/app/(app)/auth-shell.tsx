import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

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
  /* A way back, at the top, for the screens a signed-in member reaches
     from inside the app. This shell has no tab bar and no header — right
     for sign-in, wrong for the account screen, which a member opens from
     the gear on every page and could only leave by the browser's own
     back button or by scrolling nine thousand pixels to the footer. */
  back,
  /* `form` is one card, the width of the thing being filled in — a
     sign-in form stretched across a monitor is harder to use, not
     easier. `page` is for screens that are a set of unrelated sections
     rather than one task: they were being squeezed through the same
     440px slot and reading, on a desktop, as a phone screenshot. */
  width = "form",
}: {
  title: string;
  blurb: string;
  children: ReactNode;
  footer?: ReactNode;
  back?: { href: string; label: string };
  width?: "form" | "page";
}) {
  const page = width === "page";

  return (
    <main className="app-type flex min-h-dvh flex-col items-center bg-mist px-5 py-10 sm:py-16">
      <Link href="/" className="rounded-sm" aria-label="NikahCanada — home">
        <Logo variant="full" className="h-11 sm:h-14" priority />
      </Link>

      <div
        className={
          page
            ? "mt-8 w-full max-w-[940px]"
            : "mt-8 w-full max-w-[440px] rounded-lg border border-soft-green bg-white p-6 sm:p-8"
        }
      >
        {back ? (
          <Link
            href={back.href}
            className="-m-2 mb-1 inline-flex min-h-11 items-center p-2 text-[18px] text-text underline-offset-2 hover:underline"
          >
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="font-manrope text-[28px] font-bold leading-tight text-black lg:text-[32px]">
          {title}
        </h1>
        <p className="mt-2 text-[18px] leading-[26px] text-text">{blurb}</p>
        <div className="mt-7">{children}</div>
      </div>

      {footer ? (
        <p className="mt-6 text-center text-[18px] text-text">{footer}</p>
      ) : null}
    </main>
  );
}
