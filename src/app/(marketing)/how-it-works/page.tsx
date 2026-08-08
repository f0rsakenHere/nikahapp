import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { ART, PHOTO, brand } from "@/content/home";
import { intro, spine, stages, never, close, type ScreenSpec } from "@/content/howItWorks";

import { TopBar } from "@/components/bridely/TopBar";
import { Header } from "@/components/bridely/Header";
import { SiteFooter } from "@/components/bridely/SiteFooter";
import { Eyebrow, Lead, SectionHeading } from "@/components/bridely/primitives/Type";
import { PillButton } from "@/components/bridely/primitives/PillButton";
import { Reveal } from "@/components/bridely/primitives/Reveal";
import { Twinkle } from "@/components/bridely/primitives/Twinkle";
import { BannerWash } from "@/components/bridely/primitives/Decor";
import { MotionProvider } from "@/components/bridely/primitives/MotionProvider";
import { ClipboardList } from "@/components/bridely/primitives/Icons";

import { Phone } from "@/components/app/Phone";
import { SignUp, ProfileDeen, WaliSetup } from "@/components/app/screens/Onboarding";
import { Browse, ProfileDetail, MutualInterest } from "@/components/app/screens/Matching";
import { Chat, WaliPortal } from "@/components/app/screens/Conversation";
import { FeeScreen, ContactShared } from "@/components/app/screens/Completion";

export const metadata: Metadata = {
  title: `How it works — ${brand.name}`,
  description:
    "The full NikahCanada process in six steps, with the screens a member and her wali see at each stage.",
};

/* Screen id → component. Keeps all copy in the content file while the
   markup stays here. */
const SCREENS: Record<string, ReactNode> = {
  signup: <SignUp />,
  profile: <ProfileDeen />,
  wali: <WaliSetup />,
  browse: <Browse />,
  detail: <ProfileDetail />,
  mutual: <MutualInterest />,
  chat: <Chat />,
  portal: <WaliPortal />,
  fee: <FeeScreen />,
  contact: <ContactShared />,
};

/* One screen, laid out as a full row: the device on one side, the
   explanation and numbered callouts on the other. Sides alternate so the
   page has a rhythm instead of reading as a grid of thumbnails.

   The callout numerals repeat the peach pins pinned over the device, so
   the list and the screen are obviously the same numbering.

   Alternating is done by placing the two children into explicit columns
   rather than by reordering them. Reordering would leave the copy in
   whichever track it landed in, so the text measure would shrink to the
   device column's width on every flipped row and the paragraphs would
   visibly rewrap down the page. Here the device always takes the fixed
   track and the copy always takes the fluid one; only which side they
   sit on changes. */
function ScreenRow({ spec, flip }: { spec: ScreenSpec; flip: boolean }) {
  return (
    <div
      className={`grid items-center gap-12 lg:gap-16 xl:gap-[90px] ${
        flip
          ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]"
          : "lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]"
      }`}
    >
      <Reveal
        className={
          flip ? "lg:col-start-2 lg:row-start-1 lg:justify-self-end" : "lg:col-start-1"
        }
      >
        <Phone scale={0.92} pins={spec.pins}>
          {SCREENS[spec.id]}
        </Phone>
      </Reveal>

      <Reveal
        delay={0.1}
        className={`max-w-[540px] ${flip ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-2"}`}
      >
        <Eyebrow>{spec.step}</Eyebrow>

        <h3 className="mb-4 font-playfair text-[26px] font-bold leading-[34px] text-black sm:text-[32px] sm:leading-[40px] xl:mb-5 xl:text-[36px] xl:leading-[44px]">
          {spec.label}
        </h3>

        <Lead className="mb-7 xl:mb-8">{spec.what}</Lead>

        <ol className="flex flex-col gap-4 border-t border-soft-green pt-7">
          {spec.pins.map((p) => (
            <li key={p.n} className="flex gap-3.5">
              {/* peach-deep, not peach: a 13px numeral reversed out of
                  #f4a492 is 2:1, and these numerals are the only thing
                  tying the list to the pins on the device */}
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-peach-deep text-[13px] font-semibold text-white">
                {p.n}
              </span>
              <span className="font-jost text-[16px] font-light leading-[26px] text-text xl:text-[17px]">
                {p.text}
              </span>
            </li>
          ))}
        </ol>
      </Reveal>
    </div>
  );
}

export default function HowItWorksPage() {
  let rowIndex = 0;

  return (
    <MotionProvider>
      <div className="bg-white font-jost text-[16px] leading-6 text-black">
        {/* ---- Banner ----
            Shares the homepage's watercolour ground: the same 1102x1187 PNG
            pinned top-left at its natural size, so arriving here from "/"
            reads as one page continuing rather than a second site. */}
        <div
          className="relative overflow-hidden bg-[length:auto] bg-left-top bg-no-repeat"
          style={{ backgroundImage: `url(${ART}/banner-background.png)` }}
        >
          <BannerWash />
          <TopBar />
          <Header />

          <div className="relative pb-16 pt-14 sm:pt-20 xl:pb-[90px] xl:pt-[120px]">
            <Twinkle
              src={`${ART}/banner-img1.png`}
              width={178}
              height={178}
              className="pointer-events-none absolute left-[-72px] top-[120px] hidden h-[178px] w-[178px] xl:block"
            />
            <Twinkle
              src={`${ART}/banner-img2.png`}
              width={248}
              height={235}
              className="pointer-events-none absolute right-[-12px] top-[300px] hidden h-[235px] w-[248px] xl:block"
            />

            <div className="shell-b relative">
              <Reveal className="mx-auto max-w-[760px] text-center">
                <Image
                  src={`${ART}/ring-icon-banner.png`}
                  alt=""
                  width={106}
                  height={82}
                  aria-hidden
                  className="mx-auto mb-6 h-auto w-[86px] xl:mb-8 xl:w-[106px]"
                />

                <Eyebrow>{intro.eyebrow}</Eyebrow>

                {/* SectionHeading renders an h2; the page's one h1 is set
                    here at the banner size instead. */}
                <h1 className="mb-5 font-playfair text-[36px] font-bold leading-[44px] text-black sm:text-[46px] sm:leading-[54px] xl:mb-7 xl:text-[58px] xl:leading-[66px]">
                  {intro.title}
                </h1>

                <Lead>{intro.body}</Lead>
              </Reveal>

              {/* ---- the six published steps ---- */}
              <ul className="mt-12 grid gap-5 sm:grid-cols-2 xl:mt-[70px] xl:grid-cols-3 xl:gap-[30px]">
                {spine.map((s, i) => (
                  <Reveal
                    as="li"
                    key={s.n}
                    delay={i * 0.05}
                    className="rounded-tl-[40px] rounded-br-[40px] border border-soft-green bg-white/90 px-7 py-8 text-center shadow-[0_6px_38px_0_#dae0e5] backdrop-blur-sm xl:text-left"
                  >
                    <span className="font-playfair text-[40px] font-bold leading-none text-peach">
                      {s.n}
                    </span>
                    <h2 className="mb-1.5 mt-4 font-playfair text-[22px] font-bold leading-[28px] text-black">
                      {s.label}
                    </h2>
                    <p className="font-jost text-[16px] font-light leading-[24px] text-text">
                      {s.note}
                    </p>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ---- Stages ----
            White and mint alternate down the page. `--pin-ring` follows,
            because the numbered pins punch a halo out of the section
            ground and would otherwise show a white ring on mint. */}
        {stages.map((stage, si) => {
          const onMist = si % 2 === 1;
          return (
            <section
              key={stage.title}
              className={`relative overflow-hidden py-20 sm:py-24 xl:py-[130px] ${
                onMist ? "bg-mist" : "bg-white"
              }`}
              style={{ "--pin-ring": onMist ? "#edf7f8" : "#ffffff" } as CSSProperties}
            >
              <div className="shell-b relative">
                {/* ---- stage head ---- */}
                <div className="relative mb-16 grid gap-6 xl:mb-[100px] xl:grid-cols-2 xl:items-end xl:gap-[30px]">
                  <Reveal>
                    <Eyebrow>{stage.eyebrow}</Eyebrow>
                    <SectionHeading>{stage.title}</SectionHeading>
                  </Reveal>

                  <Reveal delay={0.1}>
                    <Lead>{stage.body}</Lead>
                  </Reveal>
                </div>

                {/* ---- screens ---- */}
                <div className="flex flex-col gap-24 xl:gap-[130px]">
                  {stage.screens.map((spec) => (
                    <ScreenRow key={spec.id} spec={spec} flip={rowIndex++ % 2 === 1} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}

        {/* ---- What it will never have ----
            Photographic ground under a heavy white wash, the same treatment
            the homepage gives its scholars band. */}
        <section
          className="relative overflow-hidden bg-cover bg-center bg-no-repeat py-20 sm:py-24 xl:py-[140px]"
          style={{ backgroundImage: `url(${PHOTO}/event-bg.jpg)` }}
        >
          <div className="absolute inset-0 bg-white/[0.92]" aria-hidden />

          <div className="shell-b relative">
            <Reveal className="mx-auto mb-14 max-w-[680px] text-center xl:mb-[70px]">
              <Eyebrow>{never.eyebrow}</Eyebrow>
              <SectionHeading className="mb-5 xl:mb-6">{never.title}</SectionHeading>
              <Lead>{never.body}</Lead>
            </Reveal>

            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 xl:gap-[30px]">
              {never.items.map((item, i) => (
                <Reveal
                  as="li"
                  key={item.title}
                  delay={(i % 3) * 0.05}
                  className="rounded-tl-[40px] rounded-br-[40px] border border-soft-green bg-white px-7 py-8"
                >
                  <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border-2 border-peach text-peach">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </span>
                  <h3 className="mb-2 font-playfair text-[22px] font-bold leading-[28px] text-black">
                    {item.title}
                  </h3>
                  <p className="font-jost text-[16px] font-light leading-[26px] text-text">
                    {item.body}
                  </p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Close ---- */}
        <section className="relative overflow-hidden bg-mist py-20 sm:py-24 xl:py-[130px]">
          <Twinkle
            src={`${ART}/categories-img1.png`}
            width={139}
            height={100}
            className="pointer-events-none absolute left-[25px] top-[70px] hidden xl:block"
          />

          <div className="shell-b relative">
            <Reveal className="mx-auto max-w-[680px] text-center">
              <Image
                src={`${ART}/categories-logo-img.png`}
                alt=""
                width={150}
                height={94}
                aria-hidden
                className="mx-auto mb-6 h-auto w-[110px] xl:mb-8 xl:w-[150px]"
              />
              <SectionHeading className="mb-5 xl:mb-6">{close.title}</SectionHeading>
              <Lead className="mb-8 xl:mb-9">{close.body}</Lead>
              <PillButton href={close.cta.href} icon={<ClipboardList />}>
                {close.cta.label}
              </PillButton>
              <p className="mx-auto mt-7 max-w-[460px] font-jost text-[16px] font-light leading-[26px] text-text">
                {close.note}
              </p>
            </Reveal>
          </div>
        </section>

        <SiteFooter />
      </div>
    </MotionProvider>
  );
}
