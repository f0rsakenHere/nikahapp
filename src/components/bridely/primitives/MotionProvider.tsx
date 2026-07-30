"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/* Reduced-motion handling lives here rather than in each component.

   Calling useReducedMotion() inside a component and branching on it breaks
   hydration: the server always sees `false`, so it renders the animated
   branch (style="opacity:0"), while a client with the OS setting on renders
   the plain one — React then warns and refuses to patch it up.

   MotionConfig applies the adjustment at runtime instead, after hydration,
   so every component ships identical markup from both sides. `user` means
   Framer drops transform and layout animation for those readers and keeps
   opacity, which is the usual line to draw. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
