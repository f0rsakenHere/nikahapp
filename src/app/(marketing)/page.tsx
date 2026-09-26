import { currentUser } from "@/lib/auth/current";
import { LandingHeader } from "@/components/marketing/LandingHeader";
import { Closing, Faq, Hero, HowItWorks, LandingFooter, TrustMarks, Why } from "@/components/marketing/sections";

export default async function HomePage() {
  const signedIn = Boolean(await currentUser());
  return (
    <div className="landing-page">
      <LandingHeader signedIn={signedIn} />
      <main>
        <Hero signedIn={signedIn} />
        <TrustMarks />
        <HowItWorks />
        <Why />
        <Faq />
        <Closing signedIn={signedIn} />
      </main>
      <LandingFooter />
    </div>
  );
}
