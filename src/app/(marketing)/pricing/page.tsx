import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { currentUser } from "@/lib/auth/current";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { pricing } from "@/content/pricing";
import { socialImages, socialMetadata } from "@/lib/social-metadata";
import { LandingHeader } from "@/components/marketing/LandingHeader";
import { LandingFooter } from "@/components/marketing/sections";
import { ArrowIcon, HeartIcon, LeafIcon, PeopleIcon, ProfileIcon, ShieldIcon } from "@/components/marketing/icons";
import "@/components/marketing/pricing.css";

const DESCRIPTION =
  "Membership is $9.99 a month for sisters and $19.99 for brothers. Registering, browsing and asking to talk are free.";

export const metadata: Metadata = {
  title: "Simple, transparent pricing | NikahCanada",
  description: DESCRIPTION,
  ...socialMetadata("Simple, transparent pricing | NikahCanada", DESCRIPTION, "/pricing", socialImages.pricing),
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

export default async function PricingPage() {
  const session = await currentUser();
  const signedIn = Boolean(session);
  /* Somebody signed in who presses a price wants to buy that thing, so
     it goes to the page where they can. It used to go to the dashboard,
     which is not an answer to the question they asked — and because
     they were already signed in, landing on their own dashboard read as
     the button having done nothing at all.
   *
   * Signed out it is still registration: there is no account to attach
   * a membership to yet, and registering always continues to onboarding
   * rather than honouring a destination. */
  const startHref = signedIn ? "/membership" : "/register";

  /* Which of the two prices is actually yours.
   *
   * The price follows gender, which is fixed at signup — so these are
   * not two things to choose between, they are one fact about you and
   * one fact about somebody else. Presented as two identical buttons it
   * read as a choice, and a sister who pressed "Brothers" landed on a
   * page quoting her $9.99 and reasonably concluded the button was
   * broken. Signed in, only your own plan is offered; the other is
   * stated and left alone.
   *
   * Null for a wali, who has no profile and buys nothing. Both cards
   * stay pressable in that case and /membership sends him onward. */
  const gender = session ? (await findProfileByUserId(session.user.id))?.gender ?? null : null;
  const mine = gender === "sister" ? "Sisters" : gender === "brother" ? "Brothers" : null;
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

          {/* Two plans, and neither is "most popular" — there is no choice
              to make here, only the one that applies to you. */}
          <section id="pricing-plans" className="pricing-plans" aria-label="Membership">
            {pricing.plans.map((plan, i) => {
              const yours = mine === null || mine === plan.who;
              return (
                <article key={plan.who} className={`pricing-card${mine === plan.who ? " is-featured" : ""}`}>
                  <span className="pricing-plan-icon" aria-hidden="true">
                    {i === 0 ? <ProfileIcon /> : <PeopleIcon />}
                  </span>
                  <h2>{plan.who}</h2>
                  <p className="pricing-price">
                    <span className="pricing-currency">CAD</span>
                    <span>${plan.price}</span>
                    <span className="pricing-period">/ month</span>
                  </p>
                  <p className="pricing-plan-description">{plan.description}</p>
                  {yours ? (
                    <Link
                      href={startHref}
                      className="landing-button pricing-plan-button"
                      aria-label={`Get started, ${plan.who.toLowerCase()} membership at $${plan.price} a month`}
                    >
                      Get started
                      <span className="landing-button-arrow" aria-hidden="true"><ArrowIcon /></span>
                    </Link>
                  ) : (
                    /* Not a disabled button. A greyed-out button invites
                       a press and then refuses it, which is the thing we
                       are trying to stop happening here. */
                    <p className="pricing-plan-note">What {plan.who.toLowerCase()} pay.</p>
                  )}
                </article>
              );
            })}
          </section>

          <section className="pricing-connection" aria-labelledby="connection-title">
            <span className="pricing-question-icon" aria-hidden="true">?</span>
            <div className="pricing-connection-copy">
              <h2 id="connection-title">What are you paying for?</h2>
              <p>The messages, and only the messages. Your profile, the pool, asking to talk and answering somebody who asks are all free, and stay free.</p>
              <span className="pricing-unlimited"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 3a9 9 0 0 0-7.6 13.8L3 21l4.4-1.3A9 9 0 1 0 12 3Z" /><circle cx="8" cy="12" r="1" fill="#edf4ee" /><circle cx="12" cy="12" r="1" fill="#edf4ee" /><circle cx="16" cy="12" r="1" fill="#edf4ee" /></svg>Unlimited messages while your membership is active.</span>
            </div>
            <ul className="pricing-connection-examples">
              {pricing.included.map((row) => (
                <li key={row.what}>
                  <strong>{row.cost}</strong> {row.what}
                </li>
              ))}
            </ul>
          </section>

          <section className="pricing-ready" aria-labelledby="pricing-ready-title">
            <h2 id="pricing-ready-title">Ready to find your future spouse?</h2>
            <p>Begin with a free profile. Membership only matters once a conversation is under way.</p>
            <Link href={startHref} className="landing-button">{signedIn ? "Go to membership" : "Choose Your Plan"}<span className="landing-button-arrow" aria-hidden="true"><ArrowIcon /></span></Link>
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
