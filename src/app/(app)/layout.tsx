import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MotionProvider } from "@/components/bridely/primitives/MotionProvider";

/* ------------------------------------------------------------------
   THE PRODUCT — member app and wali portal.

   Route groups do not appear in the URL, so a screen added at
   `(app)/introductions/page.tsx` serves `/introductions`. The group
   exists to give the product its own layout and its own middleware
   boundary, separate from the public marketing site in `(marketing)`.

   What belongs in this layout as it gets built:
     - the session provider, and the redirect for signed-out visitors
     - app chrome: the bottom navigation from components/app/kit.tsx
     - the locale provider (en-CA / fr-CA)

   See docs/APP-PLAN.md §4.3.
   ------------------------------------------------------------------ */

/* Nothing behind a sign-in should ever be indexed. Declared here rather
   than per-page so it cannot be forgotten on a new screen; it applies as
   soon as the first route lands under this group. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  /* One place for the reduced-motion contract, so no screen has to
     remember it. `user` drops transform and layout animation for readers
     who have asked for that and keeps opacity — see the note in
     MotionProvider on why this cannot be a per-component check. */
  return (
    <MotionProvider>
      <div className="min-h-dvh bg-white font-manrope text-black">{children}</div>
    </MotionProvider>
  );
}
