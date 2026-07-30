import { ART } from "@/content/home";
import { TopBar } from "@/components/bridely/TopBar";
import { Header } from "@/components/bridely/Header";
import { Hero } from "@/components/bridely/Hero";
import { About } from "@/components/bridely/About";
import { VideoBand } from "@/components/bridely/VideoBand";
import { Categories } from "@/components/bridely/Categories";
import { Reservation } from "@/components/bridely/Reservation";
import { EventTogether } from "@/components/bridely/EventTogether";
import { Organizers } from "@/components/bridely/Organizers";
import { Story } from "@/components/bridely/Story";
import { ContactForm } from "@/components/bridely/ContactForm";
import { Partners } from "@/components/bridely/Partners";
import { Gallery } from "@/components/bridely/Gallery";
import { SiteFooter } from "@/components/bridely/SiteFooter";
import { BannerWash } from "@/components/bridely/primitives/Decor";
import { MotionProvider } from "@/components/bridely/primitives/MotionProvider";

/* The top bar, nav, banner and About share one watercolour backdrop —
   the template's `.home-header-section`. It is a 1102x1187 PNG pinned to
   the top-left at its natural size, not stretched. */
export default function HomePage() {
  return (
    <MotionProvider>
      <div className="bg-white font-jost text-[16px] leading-6 text-black">
        <div
          className="relative overflow-hidden bg-[length:auto] bg-left-top bg-no-repeat"
          style={{ backgroundImage: `url(${ART}/banner-background.png)` }}
        >
          <BannerWash />
          <TopBar />
          <Header />
          <Hero />
          <About />
        </div>

        <VideoBand />
        <Categories />
        <Reservation />
        <EventTogether />
        <Organizers />
        <Story />
        <ContactForm />
        <Partners />
        <Gallery />
        <SiteFooter />
      </div>
    </MotionProvider>
  );
}
