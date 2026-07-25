import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { brand } from "@/content/site";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import "./globals.css";

/* Serif display against a clean sans — the pairing carries most of the
   "considered, not an app" feeling the brand needs. */
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
    /* Nav and Footer live here, not in a page, so every route gets them.
       The Nav sits transparent over the hero, so each page must open with
       a dark section. */
    <html lang="en" className={`${fraunces.variable} ${jakarta.variable}`}>
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
