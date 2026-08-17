"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { brand, nav } from "@/content/home";
import { Logo } from "@/components/brand/Logo";
import { HomeIcon } from "@/components/app/icons";
import { PillButton } from "./primitives/PillButton";

/* The main nav bar.

   One deliberate deviation from the template: it padded this bar
   asymmetrically (180px left, 40px right at 1440) through a stack of
   breakpoint overrides, which left the logo sitting ~70px inboard of every
   other section's left rail. This uses the same shell as the rest of the
   page so the nav and the content share one rail. */
export function Header({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState(false);
  /* Which link gets the mint treatment. The template hard-coded the first
     one, which was fine while there was one page; now that /how-it-works
     runs the same header, it has to be derived. Hash links all belong to
     the homepage, so only the path is compared. */
  const pathname = usePathname();

  return (
    <header className="relative z-50 pt-[26px]">
      <div className="shell-b flex items-center">
        {/* The padding carries the tap target, not the artwork. A 20px
            wordmark inside `py-1.5` is a 32px link, and 40 is the floor —
            so the padding grew as the logo shrank, and the negative
            margin keeps the header the height it was. */}
        <Link href="/" className="-my-2.5 shrink-0 py-2.5" aria-label={`${brand.name} home`}>
          {/* Sized to the width the header was built around, not to the
              old height. The ringed mark was 1282×248 and stacked the
              rings above the script; the wordmark is 1282×163 and is all
              script, so h-8 went from 165px wide to 252 and pushed the
              right cluster off a 320px screen. h-5 is the same 157px it
              always was — and because none of that height is rings any
              more, the lettering is bigger than it was before. */}
          <Logo className="h-5 xl:h-7" priority />
        </Link>

        {/* ---- desktop nav ---- */}
        <nav className="ml-auto hidden items-center gap-[30px] lg:flex xl:ml-20 xl:mr-auto">
          {nav.links.map((l) => {
            const [path, hash] = l.href.split("#");
            // a link to a section is never "the current page"
            const active = !hash && path.replace(/\/$/, "") === pathname.replace(/\/$/, "");
            return (
              <Link
                key={l.label}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={
                  "p-2 font-jost text-[18px] leading-5 transition-colors hover:text-accent " +
                  (active ? "text-accent" : "text-black")
                }
              >
                {l.label}
              </Link>
            );
          })}

          <div
            className="relative"
            onMouseEnter={() => setPages(true)}
            onMouseLeave={() => setPages(false)}
          >
            <button
              type="button"
              onClick={() => setPages((v) => !v)}
              aria-expanded={pages}
              className="flex items-center gap-1.5 p-2 font-jost text-[18px] leading-5 text-black transition-colors hover:text-accent"
            >
              {nav.dropdown.label}
              <span aria-hidden className="text-[9px]">
                ▼
              </span>
            </button>

            <AnimatePresence>
              {pages ? (
                <motion.ul
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="absolute left-0 top-[46px] w-[180px] overflow-hidden bg-accent py-0"
                >
                  {nav.dropdown.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={() => setPages(false)}
                        className="block px-[11px] py-3 font-jost text-[18px] leading-[18px] text-white transition-colors hover:bg-peach"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </motion.ul>
              ) : null}
            </AnimatePresence>
          </div>
        </nav>

        {/* ---- right cluster ---- */}
        <div className="ml-auto flex items-center gap-[5px] lg:ml-0">
          {signedIn ? (
            <>
              {/* The glyph alone under sm. The full pill is 150px, and a
                  320px screen has 280 for a wordmark, this, and the
                  hamburger — so the label goes and the way in stays,
                  rather than the reverse. Named for a screen reader
                  either way. */}
              <Link
                href={nav.dashboard.href}
                aria-label={nav.dashboard.label}
                className="grid h-11 w-11 place-items-center rounded-full border-2 border-accent text-[20px] text-accent transition-colors hover:bg-accent hover:text-white sm:hidden"
              >
                <HomeIcon />
              </Link>
              <div className="hidden sm:flex">
                <PillButton href={nav.dashboard.href} variant="nav" icon={<HomeIcon />}>
                  {nav.dashboard.label}
                </PillButton>
              </div>
            </>
          ) : (
            /* Wrapped rather than given `hidden` directly: PillButton
               carries its own display class, which beat the utility and
               left a 113px button on a 320px screen — pushing the
               hamburger, the only way into the menu there, off the right
               edge entirely. Both live in the drawer at that size. */
            <div className="hidden items-center gap-[5px] sm:flex">
              <PillButton href={nav.cta.href} variant="nav">
                {nav.cta.label}
              </PillButton>

              {/* The template put a search control here. There is nothing to
                  search — the pool is behind sign-in and is never public — so
                  this is the returning member's way in instead, which the page
                  otherwise had no link to at all. */}
              <Link
                href={nav.signIn.href}
                className="flex h-[49px] items-center justify-center rounded-full border-2 border-peach px-5 font-jost text-[16px] text-peach transition-colors hover:border-accent hover:text-accent"
              >
                {nav.signIn.label}
              </Link>
            </div>
          )}

          {/* hamburger — three bars, as in the template's toggler */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle menu"
            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-[5px] rounded-lg border-2 border-accent lg:hidden"
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block h-[2px] w-5 origin-center rounded-full bg-accent"
                animate={
                  open
                    ? [{ rotate: 45, y: 7 }, { opacity: 0 }, { rotate: -45, y: -7 }][i]
                    : { rotate: 0, y: 0, opacity: 1 }
                }
                transition={{ duration: 0.2 }}
              />
            ))}
          </button>
        </div>
      </div>

      {/* ---- mobile drawer ---- */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden lg:hidden"
          >
            <div className="shell-b pb-4 pt-4">
              <ul className="overflow-hidden rounded-2xl border border-soft-green bg-white/95 backdrop-blur">
                {[...nav.links, ...nav.dropdown.items].map((l) => (
                  <li key={l.label} className="border-b border-soft-green last:border-0">
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="block px-5 py-3.5 font-jost text-[17px] text-black transition-colors hover:bg-mist hover:text-accent"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {/* Nothing here for a member: the dashboard is a glyph in
                  the bar at this width, always visible, so repeating it
                  inside the drawer would be the only item in it that is
                  also outside it. */}
              {signedIn ? null : (
                <div className="mt-4 flex flex-col gap-3 sm:hidden">
                  <PillButton href={nav.cta.href} variant="nav" className="w-full">
                    {nav.cta.label}
                  </PillButton>
                  <Link
                    href={nav.signIn.href}
                    onClick={() => setOpen(false)}
                    className="flex h-[49px] w-full items-center justify-center rounded-full border-2 border-peach font-jost text-[16px] text-peach"
                  >
                    {nav.signIn.label}
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
