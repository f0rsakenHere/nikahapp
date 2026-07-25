import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { Phone } from "@/components/app/Phone";
import { SignUp, ProfileDeen, WaliSetup } from "@/components/app/screens/Onboarding";
import { Introductions, ProfileDetail, MutualInterest } from "@/components/app/screens/Matching";
import { Chat, WaliPortal } from "@/components/app/screens/Conversation";
import { FeeScreen, ContactShared } from "@/components/app/screens/Completion";
import { Button, Eyebrow } from "@/components/ui";
import { brand } from "@/content/site";
import { intro, spine, stages, never, close, type ScreenSpec } from "@/content/howItWorks";

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
  introductions: <Introductions />,
  detail: <ProfileDetail />,
  mutual: <MutualInterest />,
  chat: <Chat />,
  portal: <WaliPortal />,
  fee: <FeeScreen />,
  contact: <ContactShared />,
};

/* One screen, laid out as a full row: the device on one side, the
   explanation and numbered callouts on the other. Sides alternate so the
   page has a rhythm instead of reading as a grid of thumbnails. */
function ScreenRow({ spec, flip }: { spec: ScreenSpec; flip: boolean }) {
  return (
    <div
      className={`grid items-center gap-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-20 ${
        flip ? "lg:[&>*:first-child]:order-2" : ""
      }`}
    >
      <div className={flip ? "lg:flex lg:justify-end" : ""}>
        <Phone scale={0.92} pins={spec.pins}>
          {SCREENS[spec.id]}
        </Phone>
      </div>

      <div className="flex max-w-[520px] flex-col gap-5">
        <div className="flex flex-col gap-3">
          <span className="text-eyebrow uppercase text-brass">{spec.step}</span>
          <h3 className="font-display text-[28px] leading-tight text-ink md:text-d3">
            {spec.label}
          </h3>
          <p className="text-body text-body">{spec.what}</p>
        </div>

        <ol className="flex flex-col gap-3.5 border-t border-line pt-5">
          {spec.pins.map((p) => (
            <li key={p.n} className="flex gap-3.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brass text-[12px] font-bold text-ink">
                {p.n}
              </span>
              <span className="text-sm text-ink/75">{p.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function HowItWorksPage() {
  let rowIndex = 0;

  return (
    <>
      {/* ---- Header ---- */}
      {/* Top padding clears the 96px transparent nav from the root layout. */}
      <section className="relative overflow-hidden bg-ink px-6 pb-24 pt-36 lg:px-10 lg:pb-32 lg:pt-44">
        {/* Photographic ground, scrimmed the same way as the home hero so the
            two pages read as one system. */}
        <div aria-hidden className="absolute inset-0">
          <Image
            src="/images/hiw-bg.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-ink/[0.87]" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/45" />
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-24 h-[640px] w-[640px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, #B8894A55 0%, transparent 68%)" }}
        />

        <div className="shell relative flex flex-col gap-8">
          <Eyebrow onDark>{intro.eyebrow}</Eyebrow>

          <h1 className="max-w-[820px] text-[40px] leading-[1.08] tracking-[-1.2px] text-cream lg:text-d1">
            {intro.title}
          </h1>

          <p className="max-w-[640px] text-lead text-body-dark">{intro.body}</p>

          {/* The six published steps, as the spine of the page. */}
          <ol className="mt-6 grid gap-px overflow-hidden rounded-lg border border-white/12 bg-white/12 sm:grid-cols-2 lg:grid-cols-3">
            {spine.map((s) => (
              <li key={s.n} className="flex flex-col gap-1.5 bg-ink p-6">
                <span className="font-display text-[22px] text-brass-soft">{s.n}</span>
                <span className="text-body font-semibold text-cream">{s.label}</span>
                <span className="text-sm text-body-dark/70">{s.note}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Stages ---- */}
      {stages.map((stage, si) => (
        <section
          key={stage.title}
          className={`px-6 py-20 lg:px-10 lg:py-28 ${si % 2 === 0 ? "bg-cream" : "bg-shell"}`}
        >
          <div className="shell flex flex-col gap-16">
            <div className="grid gap-8 lg:grid-cols-[1fr_520px] lg:items-end lg:gap-20">
              <div className="flex flex-col gap-6">
                <Eyebrow>{stage.eyebrow}</Eyebrow>
                <h2 className="max-w-[540px] text-[32px] leading-[1.12] tracking-[-0.6px] text-ink md:text-d2">
                  {stage.title}
                </h2>
              </div>
              <p className="text-body text-body lg:pb-2">{stage.body}</p>
            </div>

            <div className="flex flex-col gap-24">
              {stage.screens.map((spec) => (
                <ScreenRow key={spec.id} spec={spec} flip={rowIndex++ % 2 === 1} />
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* ---- What it will never have ---- */}
      <section className="bg-ink px-6 py-24 lg:px-10 lg:py-32">
        <div className="shell flex flex-col gap-14">
          <div className="flex max-w-[620px] flex-col gap-6">
            <Eyebrow onDark>{never.eyebrow}</Eyebrow>
            <h2 className="text-[32px] leading-[1.12] tracking-[-0.6px] text-cream md:text-d2">
              {never.title}
            </h2>
            <p className="text-lead text-body-dark">{never.body}</p>
          </div>

          <ul className="grid gap-px overflow-hidden rounded-lg border border-white/12 bg-white/12 md:grid-cols-2 lg:grid-cols-3">
            {never.items.map((i) => (
              <li key={i.title} className="flex flex-col gap-2.5 bg-ink p-7">
                <span className="flex items-center gap-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brass/40 text-brass-soft">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </span>
                  <h3 className="text-body font-semibold text-cream">{i.title}</h3>
                </span>
                <p className="text-sm text-body-dark/80">{i.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- Close ---- */}
      <section className="bg-shell px-6 py-24 lg:px-10 lg:py-32">
        <div className="shell flex flex-col items-center gap-7 text-center">
          <h2 className="max-w-[620px] text-[32px] leading-[1.1] tracking-[-0.8px] text-ink md:text-d2">
            {close.title}
          </h2>
          <p className="max-w-[560px] text-lead text-body">{close.body}</p>
          <Button href={close.cta.href} variant="solid">
            {close.cta.label}
          </Button>
          <p className="max-w-[460px] text-sm text-body/70">{close.note}</p>
        </div>
      </section>
    </>
  );
}
