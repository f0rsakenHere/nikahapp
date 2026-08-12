import type { Metadata } from "next";
import { Jost, Manrope, Playfair_Display } from "next/font/google";
import { brand } from "@/content/home";
import "./globals.css";

/* Two type systems, on purpose.
 *
 * The marketing site keeps Playfair Display over Jost — it is the
 * template's voice and the public pages were designed around it.
 *
 * The product runs on Manrope alone, headings included. An application
 * somebody uses every week wants one family with a wide weight range
 * rather than a display face borrowed from a brochure: Playfair set at
 * 20px in a card reads as a magazine standfirst, not as a label on a
 * thing you are about to press.
 *
 * Fraunces and Plus Jakarta went with the old /how-it-works design;
 * nothing rendered references them any more, so they are not fetched. */
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope-sans",
  display: "swap",
  /* 800 for the display sizes the app used Playfair at — at 22–32px a
     600 heading does not separate from 18px semibold body text. */
  weight: ["400", "500", "600", "700", "800"],
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
    <html lang="en-CA" className={`${playfair.variable} ${jost.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
