"use client";

/* The homepage's own header.
 *
 * Four things and a button, which is the whole nav: two anchors down
 * this page, the process in full on its own page, and the way in. The
 * old marketing header carried a dropdown of six more, most of which
 * pointed at sections that no longer exist.
 *
 * A signed-in member is offered their account rather than "Register
 * Now" — the site failing to recognise its own customer is a small
 * insult that costs nothing to avoid.
 */

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const LINKS = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Why NikahCanada", href: "/#why" },
  { label: "FAQ", href: "/#faq" },
];

export function LandingHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const cta = signedIn
    ? { label: "Your account", href: "/dashboard" }
    : { label: "Register now", href: "/register" };

  return (
    <header className="relative z-40 border-b border-soft-green/70 bg-white/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-4 sm:gap-6 sm:px-8">
        <Link href="/" className="-my-2 shrink-0 py-2" aria-label="NikahCanada — home">
          <Logo variant="full" className="h-7 min-[400px]:h-9 sm:h-11" priority />
        </Link>

        <nav className="ml-auto hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-jost text-[18px] text-text transition-colors hover:text-accent-deep"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <Link
          href={cta.href}
          className="ml-auto hidden h-11 items-center rounded-pill bg-peach px-6 font-jost text-[18px] font-semibold leading-none text-black transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_8px_18px_-10px_rgba(156,66,45,0.7)] lg:ml-0 lg:flex"
        >
          {cta.label}
        </Link>

        {/* Under lg the nav folds into the menu. The button comes with
            it below 360px — at that width the logo, a pill and a burger
            do not fit, and the menu carries the same link. */}
        <Link
          href={cta.href}
          className="ml-auto hidden h-11 items-center rounded-pill bg-peach px-3.5 font-jost text-[18px] font-semibold leading-none text-black min-[360px]:flex lg:hidden"
        >
          {cta.label}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="landing-nav"
          className="ml-auto grid h-11 w-11 shrink-0 place-items-center text-accent-deep min-[360px]:ml-1 lg:hidden"
        >
          <span className="sr-only">{open ? "Close the menu" : "Open the menu"}</span>
          <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6">
            {open ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      <nav
        id="landing-nav"
        hidden={!open}
        className="border-t border-soft-green/70 bg-white px-5 pb-4 sm:px-8 lg:hidden"
      >
        <ul className="flex flex-col">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                className="block border-b border-soft-green/60 py-3.5 font-jost text-[18px] text-text last:border-0"
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li className="min-[360px]:hidden">
            <Link
              href={cta.href}
              onClick={() => setOpen(false)}
              className="block border-b border-soft-green/60 py-3.5 font-jost text-[18px] font-semibold leading-none text-black"
            >
              {cta.label}
            </Link>
          </li>
          <li>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block py-3.5 font-jost text-[18px] font-semibold text-accent-deep"
            >
              Sign in
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
