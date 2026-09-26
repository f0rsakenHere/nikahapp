import type { Metadata } from "next";
import { Lora, Manrope } from "next/font/google";
import { brand } from "@/content/home";
import "./globals.css";

// Lora gives public headings a restrained serif style. Manrope keeps
// body copy and the member interface clear at smaller sizes.
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora-serif",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: `${brand.name} | ${brand.tagline}`,
  description:
    "Send us your profile for free and we will help you find a match according to your " +
    "preferences. Profiles kept confidential. Based in Montreal, operating across " +
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
    <html lang="en-CA" className={`${lora.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
