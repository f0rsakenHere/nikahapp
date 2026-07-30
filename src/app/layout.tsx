import type { Metadata } from "next";
import {
  Fraunces,
  Jost,
  Playfair_Display,
  Plus_Jakarta_Sans,
} from "next/font/google";
import { brand } from "@/content/site";
import "./globals.css";

/* Two type systems live here while the site is mid-rebuild.

   Playfair Display + Jost drive the new Bridely homepage. Fraunces +
   Jakarta still drive /how-it-works, which has not been reskinned yet.
   Both are declared as CSS variables and cost nothing on the routes that
   do not reference them. */
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

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
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
    /* Nav and Footer are per-route rather than global: the homepage ships
       its own light header and footer, while /how-it-works keeps the dark
       pair it was designed against. */
    <html
      lang="en"
      className={`${playfair.variable} ${jost.variable} ${fraunces.variable} ${jakarta.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
