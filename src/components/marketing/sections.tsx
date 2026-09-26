import Link from "next/link";
import { closing, faq, hero, howItWorks, marks, why } from "@/content/landing";
import { ArrowIcon, ChevronIcon, ICONS, type IconName } from "./icons";
import { FaqAccordion } from "./FaqAccordion";
import { MarketingLogo } from "./MarketingLogo";

export function Hero({ signedIn }: { signedIn: boolean }) {
  const cta = signedIn ? hero.signedIn : hero.cta;
  return (
    <section id="top" className="landing-hero">
      <div className="landing-shell landing-hero-inner">
        <div className="landing-hero-copy">
          <h1><span>{hero.question.plain}</span><span>{hero.question.accent}</span></h1>
          <p className="landing-welcome">{hero.welcome}</p>
          <p className="landing-intro">Begin your journey toward<br className="landing-desktop-break" /> completing half of your faith.</p>
          <p className="landing-description">{hero.body}</p>
          <Link href={cta.href} className="landing-button landing-profile-button">
            <span>{cta.label}</span><span className="landing-button-arrow" aria-hidden="true"><ArrowIcon /></span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function TrustMarks() {
  return (
    <div className="landing-shell landing-trust">
      <ul className="landing-marks" aria-label="Our approach">
        {marks.map((mark) => {
          const Icon = ICONS[mark.icon as IconName];
          return <li key={mark.label}><Icon /><span>{mark.label}</span></li>;
        })}
      </ul>
    </div>
  );
}

function Ornament() {
  return <div className="landing-ornament" aria-hidden="true"><span /><i /><span /></div>;
}

export function HowItWorks() {
  return (
    <section id="how" className="landing-steps landing-shell" aria-labelledby="landing-how-title">
      <div className="landing-steps-panel">
        <h2 id="landing-how-title"><span className="landing-desktop-only">{howItWorks.title}</span><span className="landing-mobile-only">{howItWorks.mobileTitle}</span></h2>
        <Ornament />
        <p className="landing-steps-intro landing-mobile-only">{howItWorks.mobileIntro}</p>
        <ol className="landing-step-grid">
          {howItWorks.steps.map((step) => {
            const Icon = ICONS[step.icon as IconName];
            return (
              <li key={step.n}>
                <div className={`landing-step-illustration landing-step-${step.n}`}>
                  <span className="landing-step-number">{step.n}</span><Icon />
                </div>
                <div className="landing-step-copy">
                  <h3>{step.n === 1 ? <>Create Your Profile<br className="landing-desktop-only" />{" "}for Free</> : step.n === 2 ? <>Search for a<br className="landing-desktop-only" />{" "}Compatible Spouse</> : <>Express Interest<br className="landing-desktop-only" />{" "}&amp; Connect</>}</h3>
                  <p><span className="landing-desktop-only">{step.body}</span><span className="landing-mobile-only">{step.mobileBody}</span></p>
                </div>
                {step.n < 3 && <ArrowIcon className="landing-step-arrow" />}
                <Link href={step.n === 1 ? "/register" : "/how-it-works"} className="landing-mobile-only landing-step-details" aria-label={step.n === 1 ? "Create your free profile" : `Learn how to ${step.title.toLowerCase()}`}><ChevronIcon /></Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export function Why() {
  return (
    <section id="why" className="landing-values landing-shell" aria-label="Why NikahCanada">
      <ul>
        {why.points.map((point, index) => {
          const Icon = ICONS[point.icon as IconName];
          return (
            <li key={point.title}>
              <span className={`landing-value-icon ${index % 2 ? "is-coral" : "is-sage"}`}><Icon /></span>
              <h3>{point.title}</h3><span className="landing-value-rule" aria-hidden="true" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="landing-faq landing-shell" aria-labelledby="landing-faq-title">
      <div className="landing-faq-panel">
        <div className="landing-faq-intro">
          <span className="landing-faq-eyebrow">Here to help</span>
          <h2 id="landing-faq-title">{faq.title}</h2>
          <p>Learn about profiles, privacy, and connecting with someone for marriage.</p>
          <Link href="/how-it-works" className="landing-faq-link">Explore how it works<ArrowIcon /></Link>
        </div>
        <FaqAccordion items={faq.items} />
      </div>
    </section>
  );
}

export function Closing({ signedIn }: { signedIn: boolean }) {
  if (signedIn) return null;
  return (
    <section className="landing-closing landing-shell">
      <h2>{closing.title}</h2><p>{closing.body}</p>
      <Link href={closing.cta.href} className="landing-button">{closing.cta.label}<span className="landing-button-arrow" aria-hidden="true"><ArrowIcon /></span></Link>
      <p className="landing-login">Already a member? <Link href="/login">Sign in</Link></p>
    </section>
  );
}

export function LandingFooter() {
  const MapleLeaf = ICONS.leaf;
  return (
    <footer className="landing-footer">
      <div className="landing-shell landing-footer-inner">
        <div className="landing-footer-grid">
          <div className="landing-footer-brand">
            <Link href="/" className="landing-footer-logo-link" aria-label="NikahCanada home">
              <MarketingLogo tone="white" className="landing-footer-logo" />
            </Link>
            <p>A thoughtful path to marriage, with faith and family at the heart of your journey.</p>
            <span className="landing-footer-location"><MapleLeaf />Serving Muslims across Canada</span>
          </div>
          <nav aria-label="Explore NikahCanada">
            <h3 className="landing-footer-heading">Explore</h3>
            <ul>
              <li><Link href="/how-it-works">How it works</Link></li>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/#why">Why NikahCanada</Link></li>
              <li><Link href="/#faq">Common questions</Link></li>
            </ul>
          </nav>
          <nav aria-label="Account links">
            <h3 className="landing-footer-heading">Your journey</h3>
            <ul>
              <li><Link href="/register">Create your profile</Link></li>
              <li><Link href="/login">Sign in</Link></li>
              <li><Link href="/dashboard">Your account</Link></li>
            </ul>
          </nav>
        </div>
        <div className="landing-footer-bottom">
          <p>© {new Date().getFullYear()} NikahCanada. All rights reserved.</p>
          <div className="landing-footer-bottom-links">
            <nav aria-label="Legal"><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link></nav>
            <Link href="#top" className="landing-footer-top">Back to top<ArrowIcon /></Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
