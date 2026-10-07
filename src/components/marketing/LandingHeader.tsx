"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarketingLogo } from "./MarketingLogo";
import "./landing.css";

const LINKS = [
  /* The page, not the homepage section of the same name: the section is
     three lines, the page is the whole process, and somebody reaching
     for this in the nav wants the latter. */
  { label: "How It Works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Why NikahCanada", href: "/#why" },
  { label: "FAQ", href: "/#faq" },
];

export function LandingHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const cta = signedIn
    ? { label: "Your Account", href: "/dashboard" }
    : { label: "Register Now", href: "/register" };
  return (
    <header className="landing-header">
      <div className="landing-shell landing-header-inner">
        <Link href="/" className="landing-brand-link" aria-label="NikahCanada home"><MarketingLogo className="landing-logo" priority /></Link>
        <nav className="landing-desktop-nav" aria-label="Main navigation">
          {LINKS.map((link) => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>{link.label}</Link>)}
        </nav>
        <Link href={cta.href} className="landing-button landing-register">{cta.label}</Link>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="landing-nav" className="landing-menu-button" aria-label={open ? "Close menu" : "Open menu"}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={open ? "M6 6l12 12M18 6 6 18" : "M4 6h16M4 12h16M4 18h16"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>
      <nav id="landing-nav" hidden={!open} className="landing-mobile-nav" aria-label="Mobile navigation">
        {LINKS.map((link) => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} onClick={() => setOpen(false)}>{link.label}</Link>)}
        <Link href={cta.href} onClick={() => setOpen(false)}>{cta.label}</Link>
        {!signedIn && <Link href="/login" onClick={() => setOpen(false)}>Sign in</Link>}
      </nav>
    </header>
  );
}
