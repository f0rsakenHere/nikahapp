import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { currentUser } from "@/lib/auth/current";
import { pricing } from "@/content/pricing";
import { socialMetadata } from "@/lib/social-metadata";
import { LandingHeader } from "@/components/marketing/LandingHeader";
import { LandingFooter } from "@/components/marketing/sections";
import { ArrowIcon, HeartIcon, LeafIcon, PeopleIcon, ProfileIcon, ShieldIcon } from "@/components/marketing/icons";
import "@/components/marketing/pricing.css";

export const metadata: Metadata = {
  title: "Simple, transparent pricing | NikahCanada",
  description: "Explore 1, 3, or 5 connection packages. Browse for free and connect when the interest is mutual.",
  ...socialMetadata("Simple, transparent pricing | NikahCanada", "Explore 1, 3, or 5 connection packages. Browse for free and connect when the interest is mutual.", "/pricing"),
};

function PricingBackdrop() {
  return (
    <div className="pricing-backdrop" aria-hidden="true">
      <svg viewBox="0 0 1280 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="pricing-pattern" width="96" height="96" patternUnits="userSpaceOnUse">
            <path d="m48 0 12 22 24-10-10 24 22 12-22 12 10 24-24-10-12 22-12-22-24 10 10-24L0 48l22-12-10-24 24 10Z" fill="none" stroke="#c9d2bf" strokeWidth=".8" />
          </pattern>
          <linearGradient id="pricing-fade"><stop offset="0" stopColor="#faf8f1" /><stop offset="1" stopColor="#faf8f1" stopOpacity="0" /></linearGradient>
        </defs>
        <rect x="700" width="580" height="600" fill="url(#pricing-pattern)" opacity=".3" />
        <rect width="1280" height="600" fill="url(#pricing-fade)" />
        <path d="M1060 600V284c0-73 48-129 113-155V80c0-37 41-75 106-108M1078 600V288c0-64 46-114 114-140V83c0-31 33-61 91-91" fill="none" stroke="#d7c79c" strokeWidth="3" opacity=".7" />
        <path d="M0 395c380 190 827 217 1280-100v305H0Z" fill="#e3ebde" opacity=".28" />
      </svg>
    </div>
  );
}

function CrownIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="m3 6 5 4 4-7 4 7 5-4-3 12H6ZM6 20h12v2H6Z" /></svg>;
}

export default async function PricingPage() {
  const signedIn = Boolean(await currentUser());
  const startHref = signedIn ? "/dashboard" : "/register";
  const values = [
    { Icon: ShieldIcon, label: "Nikah focused" },
    { Icon: PeopleIcon, label: "Wali involved" },
    { Icon: HeartIcon, label: "Sharia conscious" },
    { Icon: LeafIcon, label: "Family oriented" },
  ];

  return (
    <div className="landing-page pricing-page">
      <LandingHeader signedIn={signedIn} />
      <main id="top" className="pricing-main">
        <PricingBackdrop />
        <Image src="/images/pricing-floral.webp" alt="" width={480} height={720} className="pricing-floral pricing-floral-top" aria-hidden="true" />
        <Image src="/images/pricing-floral.webp" alt="" width={480} height={720} className="pricing-floral pricing-floral-bottom" aria-hidden="true" />
        <div className="landing-shell pricing-shell">
          <section className="pricing-intro" aria-labelledby="pricing-title">
            <h1 id="pricing-title">Simple,<br />Transparent<br /><span>Pricing</span></h1>
            <ul className="pricing-benefits">
              {pricing.benefits.map((benefit) => (
                <li key={benefit}><span className="pricing-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 12 4 4 8-9" /></svg></span><span>{benefit}</span></li>
              ))}
            </ul>
          </section>

          <section id="pricing-plans" className="pricing-plans" aria-label="Connection packages">
            {pricing.packages.map((plan) => {
              const featured = "featured" in plan && plan.featured;
              const Icon = plan.connections === 1 ? ProfileIcon : PeopleIcon;
              return (
                <article key={plan.connections} className={`pricing-card${featured ? " is-featured" : ""}`}>
                  {featured && <span className="pricing-popular"><CrownIcon />Most Popular</span>}
                  <span className="pricing-plan-icon" aria-hidden="true"><Icon /></span>
                  <h2>{plan.connections} {plan.connections === 1 ? "Connection" : "Connections"}</h2>
                  <p className="pricing-price"><span className="pricing-currency">CAD</span><span>${plan.price}</span></p>
                  <p className="pricing-plan-description">{plan.description}</p>
                  <Link href={startHref} className={`landing-button pricing-plan-button${featured ? "" : " is-secondary"}`} aria-label={`Get started with ${plan.connections} ${plan.connections === 1 ? "connection" : "connections"}`}>Get started<span className="landing-button-arrow" aria-hidden="true"><ArrowIcon /></span></Link>
                </article>
              );
            })}
          </section>

          <section className="pricing-connection" aria-labelledby="connection-title">
            <span className="pricing-question-icon" aria-hidden="true">?</span>
            <div className="pricing-connection-copy">
              <h2 id="connection-title">What is a connection?</h2>
              <p>A connection opens when both people agree to converse and are ready to connect for potential Nikah.</p>
              <span className="pricing-unlimited"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 3a9 9 0 0 0-7.6 13.8L3 21l4.4-1.3A9 9 0 1 0 12 3Z" /><circle cx="8" cy="12" r="1" fill="#edf4ee" /><circle cx="12" cy="12" r="1" fill="#edf4ee" /><circle cx="16" cy="12" r="1" fill="#edf4ee" /></svg>Unlimited conversation once a connection is opened.</span>
            </div>
            <ul className="pricing-connection-examples">
              {pricing.packages.map((plan) => <li key={plan.connections}><strong>{plan.connections} {plan.connections === 1 ? "connection" : "connections"}</strong> = {plan.connections} {plan.connections === 1 ? "mutual match" : "different mutual matches"}</li>)}
            </ul>
          </section>

          <section className="pricing-ready" aria-labelledby="pricing-ready-title">
            <h2 id="pricing-ready-title">Ready to find your future spouse?</h2>
            <p>Begin with a free profile. Connect when the interest is mutual.</p>
            <Link href={startHref} className="landing-button">{signedIn ? "Go to your account" : "Choose Your Plan"}<span className="landing-button-arrow" aria-hidden="true"><ArrowIcon /></span></Link>
          </section>

          <ul className="pricing-values" aria-label="Our approach">
            {values.map(({ Icon, label }) => <li key={label}><span><Icon /></span><p>{label}</p></li>)}
          </ul>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
