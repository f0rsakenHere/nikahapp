"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/* Stands in for the template's `data-aos="fade-up"`.

   AOS ran on its defaults here (it was never explicitly initialised), so
   the numbers below are AOS's: 100px of travel, 400ms, `ease`, firing
   120px before the element reaches the viewport edge.

   One deliberate difference: AOS defaults to `once: false` and replays the
   animation every time you scroll back up. That reads as jitter on a long
   page, so this fires once.

   Reduced motion is handled globally by MotionProvider, not with a branch
   here — branching on useReducedMotion() during render breaks hydration. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "figure" | "li";
}) {
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 100 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -120px 0px" }}
      transition={{ duration: 0.4, delay, ease: "easeInOut" }}
    >
      {children}
    </Tag>
  );
}
