"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { brand, nav } from "@/content/home";
import { Wordmark } from "./primitives/Wordmark";
import { PillButton } from "./primitives/PillButton";
import { Search } from "./primitives/Icons";

/* The main nav bar.

   One deliberate deviation from the template: it padded this bar
   asymmetrically (180px left, 40px right at 1440) through a stack of
   breakpoint overrides, which left the logo sitting ~70px inboard of every
   other section's left rail. This uses the same shell as the rest of the
   page so the nav and the content share one rail. */
export function Header() {
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
        <Link href="/" className="-my-1.5 shrink-0 py-1.5" aria-label={`${brand.name} home`}>
          <Wordmark className="text-[24px] leading-none xl:text-[30px]" />
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
          <PillButton href={nav.cta.href} variant="nav" className="hidden sm:inline-flex">
            {nav.cta.label}
          </PillButton>

          <a
            href="#"
            aria-label="Search"
            className="hidden h-[49px] w-[50px] items-center justify-center rounded-full border-2 border-peach text-[16px] text-peach transition-colors hover:border-accent hover:text-accent sm:flex"
          >
            <Search />
          </a>

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
              <div className="mt-4 sm:hidden">
                <PillButton href={nav.cta.href} variant="nav" className="w-full">
                  {nav.cta.label}
                </PillButton>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
