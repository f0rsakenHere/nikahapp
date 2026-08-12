"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { motion } from "motion/react";

/* The content pane, arriving rather than appearing.
 *
 * Navigating between tabs replaced the whole pane in one frame, which is
 * what made it feel choppy: nothing moved, the screen was simply
 * different. A short rise and fade gives the eye something to follow and
 * costs about a fifth of a second.
 *
 * Keyed by pathname so it plays on every navigation. It is deliberately
 * only on the way in — animating the outgoing screen means holding the
 * old one on screen while the new one is ready, which is slower in the
 * one way that actually matters.
 *
 * `MotionConfig reducedMotion="user"` in the layout drops the movement
 * for anyone who has asked for that and keeps the fade.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
