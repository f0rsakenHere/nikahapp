"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ART, story } from "@/content/home";
import { PillButton } from "./primitives/PillButton";
import { Reveal } from "./primitives/Reveal";
import { Twinkle } from "./primitives/Twinkle";
import { ArrowLeft, ArrowRight, Play } from "./primitives/Icons";

/* The couple's story: a white card with one square corner rounded to 100px,
   overlapping a slideshow.

   Replaces the Bootstrap carousel — same 5s interval, but cross-fading with
   Framer Motion rather than sliding, and it pauses once the tab is hidden
   so it isn't animating off-screen. */
export function Story() {
  const [index, setIndex] = useState(0);
  const still = useReducedMotion();
  const count = story.slides.length;

  const go = useCallback(
    (step: number) => setIndex((i) => (i + step + count) % count),
    [count]
  );

  /* Safe to branch on here: this runs in an effect, after hydration, so it
     never changes the server-rendered markup. */
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % count);
    }, 5000);
    return () => clearInterval(id);
  }, [count, still]);

  const slide = story.slides[index];

  return (
    <section
      id="wali"
      className="relative overflow-hidden bg-[length:auto] bg-center bg-no-repeat py-20 sm:py-28 xl:pb-[263px] xl:pt-[159px]"
      style={{ backgroundImage: `url(${ART}/story-background.png)` }}
    >
      <Twinkle
        src={`${ART}/about-bird-icon.png`}
        width={100}
        height={113}
        className="pointer-events-none absolute left-[192px] top-[-40px] hidden xl:block"
      />

      <div className="shell-b">
        <div className="relative">
          {/* ---- slideshow ---- */}
          <div className="relative ml-auto aspect-[665/523] w-full overflow-hidden xl:w-[665px]">
            <AnimatePresence initial={false} mode="sync">
              <motion.div
                key={index}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              >
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  sizes="(max-width: 1279px) 100vw, 665px"
                  className="rounded-tl-[100px] object-cover"
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ---- overlapping card ---- */}
          <Reveal className="relative z-[1] -mt-10 xl:absolute xl:left-[30px] xl:top-[100px] xl:mt-0 xl:w-[590px]">
            <div className="rounded-br-[60px] bg-white px-6 py-10 text-center shadow-[0_4px_8px_0_rgba(0,0,0,0.2)] sm:px-10 xl:rounded-br-[100px] xl:px-[50px] xl:pb-[77px] xl:pt-[74px]">
              <Image
                src={`${ART}/story-card-img.png`}
                alt=""
                width={81}
                height={80}
                aria-hidden
                className="mx-auto mb-[30px] h-auto w-[81px]"
              />
              <h3 className="mb-6 font-playfair text-[28px] font-bold leading-[36px] text-black sm:text-[34px] xl:mb-[29px] xl:text-[40px] xl:leading-[46px]">
                {story.title}
              </h3>
              <p className="mb-8 font-jost text-[18px] font-light leading-[28px] text-black xl:mb-9 xl:text-[22px] xl:leading-[30px]">
                {story.body}
              </p>
              <PillButton href={story.cta.href} variant="outline" icon={<Play />}>
                {story.cta.label}
              </PillButton>
            </div>
          </Reveal>

          {/* ---- arrows ---- */}
          <div className="mt-8 flex justify-center gap-[11px] xl:absolute xl:right-[93px] xl:top-[491px] xl:mt-0">
            {[
              { label: "Previous", step: -1, Icon: ArrowLeft },
              { label: "Next", step: 1, Icon: ArrowRight },
            ].map(({ label, step, Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => go(step)}
                aria-label={`${label} story`}
                className="flex h-[58px] w-[58px] items-center justify-center rounded-full border-2 border-white bg-accent text-[18px] text-white shadow-[0_21px_35px_-17px_rgba(20,18,18,0.2)] transition-colors hover:bg-peach"
              >
                <Icon />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
