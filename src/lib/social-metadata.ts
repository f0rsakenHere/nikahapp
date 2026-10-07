import type { Metadata } from "next";

const image = (url: string, alt: string) => ({ url, width: 1200, height: 630, type: "image/jpeg", alt });

export const socialImages = {
  home: image("/images/social-share-v1.jpg", "NikahCanada. Serious about Nikah? A thoughtful path to marriage."),
  pricing: image("/images/social-pricing-v1.jpg", "NikahCanada. Simple, transparent pricing."),
  howItWorks: image("/images/social-how-it-works-v3.jpg", "NikahCanada. A thoughtful path to Nikah."),
} as const;

export function socialMetadata(
  title: string,
  description: string,
  path: string,
  socialImage: (typeof socialImages)[keyof typeof socialImages] = socialImages.home,
): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type: "website",
      locale: "en_CA",
      siteName: "NikahCanada",
      title,
      description,
      url: path,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: socialImage.url, alt: socialImage.alt }],
    },
  };
}
