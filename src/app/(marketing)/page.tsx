import { currentUser } from "@/lib/auth/current";
import { LandingHeader } from "@/components/marketing/LandingHeader";
import { Closing, Faq, Hero, HowItWorks, Why } from "@/components/marketing/sections";
import { SiteFooter } from "@/components/bridely/SiteFooter";
import { MotionProvider } from "@/components/bridely/primitives/MotionProvider";

/* The homepage.
 *
 * Rebuilt to the client's own mock-up. What stood here was a wedding-
 * planner template with fourteen sections — a video band, a booking
 * form, a photo gallery, a partner logo wall — carrying NikahCanada's
 * words in somebody else's shapes. Most of those sections had nothing
 * true to say, and several said things this product does not do.
 *
 * What is left is the page a stranger needs: what this is, how it works,
 * why it is built this way, the questions they will ask, and the way in.
 */
export default async function HomePage() {
  /* Read, not enforced. This used to redirect a signed-in member to the
     dashboard, which meant a member could not reach their own service's
     homepage at all — not to re-read the process before explaining it to
     a relative, not to follow a link somebody had sent them. The nav
     answers instead: it offers the account where it would have offered
     "Register now".

     The session is read properly rather than sniffed from the cookie in
     middleware, which runs on the edge with no database and can only see
     that *a* cookie exists — a stale one would put a member's chrome on
     a stranger's screen. */
  const signedIn = Boolean(await currentUser());

  return (
    <MotionProvider>
      <div className="bg-white font-jost text-[16px] leading-6 text-black">
        <LandingHeader signedIn={signedIn} />
        <main>
          <Hero signedIn={signedIn} />
          <HowItWorks />
          <Why />
          <Faq />
          <Closing signedIn={signedIn} />
        </main>
        <SiteFooter />
      </div>
    </MotionProvider>
  );
}
