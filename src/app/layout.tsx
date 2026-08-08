import type { Metadata } from "next";
import { Jost, Playfair_Display } from "next/font/google";
import { brand } from "@/content/home";
import "./globals.css";

/* Playfair Display for display type, Jost for everything else — both
   routes and the in-app screens now run on this one pair. Fraunces and
   Plus Jakarta went with the old /how-it-works design; nothing rendered
   references them any more, so they are no longer fetched. */
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description:
    "Send us your profile for free and we will help you find a match according to your " +
    "preferences. Verified profiles, kept confidential. Based in Montreal, operating across " +
    "Canada, developed in collaboration with Islamic scholars.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /* Header and footer are per-route rather than global. Both routes now
       compose the same pair, but each also owns the watercolour ground the
       header sits on, which the layout has no business knowing about.

       `en-CA`, not `en` — the service operates in Canada, and this becomes
       a runtime value once fr-CA lands (docs/APP-PLAN.md §7.9: Bill 96
       makes French a legal requirement here, not a preference). */
    <html lang="en-CA" className={`${playfair.variable} ${jost.variable}`}>
      <body>{children}</body>
    </html>
  );
}
