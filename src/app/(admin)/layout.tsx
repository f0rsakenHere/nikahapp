import type { Metadata } from "next";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------
   THE STAFF CONSOLE — intake, verification, matching, oversight.

   Kept in its own route group from the start so it can be split into a
   separate deployment later without moving files: staff auth, IP
   allowlisting and a separate domain all become straightforward once
   this is the only thing in the build. Do that split when staff grow
   past a handful of people.

   What belongs in this layout as it gets built:
     - the staff session provider, and a hard gate on the staff/admin
       roles — never rely on a screen checking for itself
     - the impersonation banner (docs/APP-PLAN.md §7.8), which must be
       visible on every page of the console while it is active
     - console chrome: sidebar, pipeline counts

   See docs/APP-PLAN.md §4.3 and §8.3.
   ------------------------------------------------------------------ */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-white font-jost text-black">{children}</div>;
}
