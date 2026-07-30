"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/* Every button on the page. The template declared these eight times with
   identical hover rules (lift 5px, fill mint, text white, 0.3s ease-in-out)
   and only the padding and radius differing per placement — so the variants
   below carry the padding and the hover is defined once. */

type Variant = "solid" | "outline" | "submit" | "nav";

const BASE =
  "relative inline-flex items-center justify-center gap-2 border-2 " +
  "font-jost transition-colors duration-300 ease-in-out";

const VARIANT: Record<Variant, string> = {
  // hero / reservation / footer CTA — peach fill
  solid:
    "bg-peach border-peach text-white rounded-[60px] text-[18px] leading-[18px] " +
    "px-[45px] py-[20px]",
  // "learn more" — mint hairline, transparent so it picks up the section ground
  outline:
    "bg-transparent border-accent text-accent rounded-[72px] text-[18px] leading-5 " +
    // no `capitalize`: the template needed it for its lowercase labels,
    // ours are already sentence-cased and it turned them into Title Case
    "px-[35px] pt-[15px] pb-4",
  // booking form submit — mint fill
  submit:
    "bg-accent border-accent text-white rounded-[72px] text-[18px] leading-5 " +
    "px-[55px] py-4",
  // header "Order Services" — smaller, tighter radius
  nav:
    "bg-accent border-accent text-white rounded-[35px] text-[16px] leading-4 " +
    "px-[27px] py-[15px]",
};

const HOVER = "hover:bg-accent hover:border-accent hover:text-white";

export function PillButton({
  href,
  children,
  variant = "solid",
  icon,
  type,
  className = "",
}: {
  href?: string;
  children: ReactNode;
  variant?: Variant;
  icon?: ReactNode;
  type?: "submit";
  className?: string;
}) {
  const classes = `${BASE} ${VARIANT[variant]} ${HOVER} ${className}`;
  // MotionConfig drops this for reduced-motion readers
  const lift = { y: -5 };
  const body = (
    <>
      {icon ? <span className="shrink-0 text-[0.9em]">{icon}</span> : null}
      {children}
    </>
  );

  if (type === "submit") {
    return (
      <motion.button type="submit" className={classes} whileHover={lift}>
        {body}
      </motion.button>
    );
  }

  return (
    <motion.a href={href} className={classes} whileHover={lift}>
      {body}
    </motion.a>
  );
}
