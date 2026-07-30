"use client";

import { motion } from "motion/react";

/* The h1, with the template's `color-animation` on the second line.

   The template's keyframes were mint -> peach -> WHITE -> peach -> mint.
   The white stop is a real defect, not a style choice: on the pale banner
   the headline disappears for roughly a third of every three-second cycle,
   which is both unreadable and a contrast failure. The stop is dropped and
   the cycle now rests between the two brand colours.

   To restore the template exactly, put "#ffffff" back as the middle entry
   and add 0.33 back to `times`. */
const CYCLE = ["#9accc9", "#f4a492", "#9accc9"];

export function HeroTitle({ title, accent }: { title: string; accent: string }) {
  return (
    <h1 className="mb-6 font-playfair text-[38px] font-bold leading-[1.06] tracking-[-1px] text-black sm:text-[48px] xl:mb-[39px] xl:max-w-[496px] xl:text-[57px] xl:leading-[60px] xl:tracking-[-2px]">
      {title}{" "}
      <motion.span
        /* `.cycle` is pinned to a solid colour under reduced motion in
           globals.css — MotionConfig would otherwise keep looping it. */
        className="cycle"
        animate={{ color: CYCLE }}
        transition={{
          duration: 3,
          times: [0, 0.5, 1],
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {accent}
      </motion.span>
    </h1>
  );
}
