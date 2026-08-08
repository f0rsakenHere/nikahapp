import type { Metadata } from "next";
import type { ReactNode } from "react";

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
  return <div className="min-h-dvh bg-white font-jost text-black">{children}</div>;
}
