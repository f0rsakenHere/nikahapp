import { Hero } from "@/components/Hero";
import { Trust } from "@/components/Trust";
import { Why } from "@/components/Why";
import { Steps } from "@/components/Steps";
import { Scholars } from "@/components/Scholars";
import { Safety } from "@/components/Safety";
import { Fee } from "@/components/Fee";
import { Faq } from "@/components/Faq";
import { Cta } from "@/components/Cta";

/* Nav and Footer come from the root layout.
   Grounds alternate cream / shell with two dark anchors (Hero and
   Scholars) so the page has depth rather than one flat tone. */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Trust />
      <Why />
      <Steps />
      <Scholars />
      <Safety />
      <Fee />
      <Faq />
      <Cta />
    </>
  );
}
