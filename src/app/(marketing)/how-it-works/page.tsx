import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth/current";
import { socialMetadata } from "@/lib/social-metadata";
import { brand } from "@/content/home";
import { never, spine, stages } from "@/content/howItWorks";
import { LandingHeader } from "@/components/marketing/LandingHeader";
import { LandingFooter } from "@/components/marketing/sections";
import { ArrowIcon, ConnectIcon, HeartIcon, ProfileCardIcon, SearchIcon, ShieldIcon } from "@/components/marketing/icons";
import { Phone } from "@/components/app/Phone";
import { SignUp } from "@/components/app/screens/Onboarding";
import { Browse } from "@/components/app/screens/Matching";
import { Chat } from "@/components/app/screens/Conversation";
import "@/components/marketing/how-it-works.css";

const title = `How it works | ${brand.name}`;
const description = "See how NikahCanada takes you from a free profile to a thoughtful conversation, with mutual interest and wali involvement where it belongs.";

export const metadata: Metadata = {
  title,
  description,
  ...socialMetadata(title, description, "/how-it-works"),
};

const steps = [
  {
    ...spine[0],
    id: "profile",
    eyebrow: "BEGIN WITH YOU",
    title: "A profile that reflects who you are.",
    description: "Create an account for free, confirm your email, and tell people what matters to you. Sisters also invite a wali before their profile becomes visible.",
    details: stages[0].screens,
    screen: <SignUp />,
    Icon: ProfileCardIcon,
  },
  {
    ...spine[1],
    id: "search",
    eyebrow: "LOOK WITH INTENTION",
    title: "Find someone worth getting to know.",
    description: "Explore member profiles and narrow your search by age and province. Read about faith, family, and everyday life before expressing interest.",
    details: stages[1].screens.slice(0, 2),
    screen: <Browse />,
    Icon: SearchIcon,
  },
  {
    ...spine[2],
    id: "connect",
    eyebrow: "MOVE FORWARD TOGETHER",
    title: "A conversation starts when interest is mutual.",
    description: "Send an interest without writing a message. When the other person accepts, your conversation opens. A sister’s wali can follow the conversation in his own account.",
    details: [stages[1].screens[2], ...stages[2].screens],
    screen: <Chat />,
    Icon: ConnectIcon,
  },
] as const;

const values = [
  { label: "Free to create a profile", Icon: ProfileCardIcon },
  { label: "Private member browsing", Icon: ShieldIcon },
  { label: "Mutual interest first", Icon: HeartIcon },
  { label: "Wali involvement", Icon: ConnectIcon },
] as const;

export default async function HowItWorksPage() {
  const signedIn = Boolean(await currentUser());
  const startHref = signedIn ? "/dashboard" : "/register";

  return (
    <div className="landing-page how-page">
      <LandingHeader signedIn={signedIn} />
      <main id="top">
        <section className="how-hero" aria-labelledby="how-title">
          <div className="how-hero-art" aria-hidden="true" />
          <div className="landing-shell how-hero-inner">
            <div className="how-hero-copy">
              <span className="how-eyebrow">HOW NIKAHCANADA WORKS</span>
              <h1 id="how-title">A thoughtful path <span>to Nikah.</span></h1>
              <p>From your first profile to a meaningful conversation, each step gives you room to move forward with sincerity and care.</p>
              <div className="how-hero-actions">
                <Link href={startHref} className="landing-button">{signedIn ? "Go to your account" : "Create your free profile"}<span className="landing-button-arrow" aria-hidden="true"><ArrowIcon /></span></Link>
                <Link href="#journey" className="how-text-link">Explore the steps <ArrowIcon /></Link>
              </div>
            </div>
          </div>
        </section>

        <div className="landing-shell how-values">
          <ul aria-label="Our approach">
            {values.map(({ label, Icon }) => <li key={label}><span className="how-value-icon"><Icon /></span>{label}</li>)}
          </ul>
        </div>

        <section id="journey" className="landing-shell how-overview" aria-labelledby="how-overview-title">
          <div className="how-section-heading">
            <span className="how-eyebrow">THE JOURNEY</span>
            <h2 id="how-overview-title">Three clear steps to connect.</h2>
            <p>Take your time. Each stage begins only when you are ready.</p>
          </div>
          <ol className="how-overview-grid">
            {steps.map(({ n, label, note, id, Icon }) => (
              <li key={id}>
                <span className="how-overview-icon"><Icon /></span>
                <span className="how-overview-number">{n}</span>
                <h3>{label}</h3>
                <p>{note}</p>
                <Link href={`#${id}`} aria-label={`Read about ${label.toLowerCase()}`}>See this step <ArrowIcon /></Link>
              </li>
            ))}
          </ol>
        </section>

        <div className="how-journey">
          {steps.map(({ id, n, eyebrow, title: stepTitle, description: stepDescription, details, screen, Icon }, index) => (
            <section id={id} className={`how-stage ${index % 2 ? "is-sage" : ""}`} key={id} aria-labelledby={`${id}-title`}>
              <div className="landing-shell how-stage-inner">
                <div className="how-stage-copy">
                  <div className="how-stage-kicker"><span className="how-stage-number">{n}</span><span>{eyebrow}</span></div>
                  <span className="how-stage-icon"><Icon /></span>
                  <h2 id={`${id}-title`}>{stepTitle}</h2>
                  <p className="how-stage-description">{stepDescription}</p>
                  <ol className="how-stage-details">
                    {details.map(({ id: detailId, label, what }) => (
                      <li key={detailId}>
                        <span className="how-detail-check" aria-hidden="true">✓</span>
                        <div><h3>{label}</h3><p>{what}</p></div>
                      </li>
                    ))}
                  </ol>
                  {index === 0 && <Link href={startHref} className="how-inline-link">{signedIn ? "Go to your account" : "Start your free profile"}<ArrowIcon /></Link>}
                  {index === 2 && <Link href="/pricing" className="how-inline-link">See connection pricing <ArrowIcon /></Link>}
                </div>
                <div className="how-stage-visual" aria-label={`${stepTitle} example screen`}>
                  <span className="how-visual-orbit" aria-hidden="true" />
                  <Phone scale={0.76}>{screen}</Phone>
                  <div className="how-visual-caption"><span className="how-visual-caption-dot" /> A look inside NikahCanada</div>
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="how-promise" aria-labelledby="how-promise-title">
          <div className="landing-shell">
            <div className="how-section-heading">
              <span className="how-eyebrow">BUILT WITH INTENTION</span>
              <h2 id="how-promise-title">Space for what matters.</h2>
              <p>Thoughtful choices that keep the focus on a serious path to marriage.</p>
            </div>
            <ul className="how-promise-grid">
              {never.items.slice(0, 4).map((item, index) => {
                const Icon = [ShieldIcon, SearchIcon, ConnectIcon, HeartIcon][index];
                return <li key={item.title}><span className="how-promise-icon"><Icon /></span><h3>{item.title}</h3><p>{item.body}</p></li>;
              })}
            </ul>
          </div>
        </section>

        <section className="landing-shell how-close" aria-labelledby="how-close-title">
          <div className="how-close-panel">
            <div><span className="how-eyebrow">YOUR NEXT STEP</span><h2 id="how-close-title">Begin with a free profile.</h2><p>Learn about someone at your own pace. A conversation starts when the interest is shared.</p></div>
            <Link href={startHref} className="landing-button">{signedIn ? "Go to your account" : "Create your profile"}<span className="landing-button-arrow" aria-hidden="true"><ArrowIcon /></span></Link>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
