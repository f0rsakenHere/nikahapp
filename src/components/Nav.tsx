"use client";

import { useState } from "react";
import { brand, nav } from "@/content/site";
import { Mark } from "@/components/ui";

/* Sits transparent over the hero, so it inherits cream text and every page
   must open with a dark section.

   Padding goes on the OUTER element with .shell nested inside — the same
   rails Footer and every page section use. Putting the padding inside the
   container instead pushes the nav 40px in from the page content. */

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="px-6 lg:px-10">
        <div className="shell flex h-24 items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 text-cream">
            <Mark className="h-8 w-8 text-brass-soft" />
            <span className="font-display text-[22px] tracking-[-0.3px]">{brand.name}</span>
          </a>

          <nav className="hidden items-center gap-8 lg:flex">
            {nav.links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm text-cream/75 transition-colors hover:text-brass-soft"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={nav.cta.href}
              className="hidden h-11 items-center rounded-pill border border-white/25 px-6 text-sm font-semibold text-cream transition-colors hover:border-brass-soft hover:text-brass-soft sm:inline-flex"
            >
              {nav.cta.label}
            </a>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="Toggle menu"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/25 text-cream lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 9h16M4 15h16" />}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div className="px-6 lg:hidden">
          <div className="shell rounded-lg border border-white/15 bg-deep/95 p-4 backdrop-blur">
            <ul className="flex flex-col">
              {nav.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-3 text-sm text-cream/85 hover:bg-white/5"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="mt-2">
                <a
                  href={nav.cta.href}
                  onClick={() => setOpen(false)}
                  className="flex h-12 items-center justify-center rounded-pill bg-brass text-sm font-semibold text-ink"
                >
                  {nav.cta.label}
                </a>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </header>
  );
}
