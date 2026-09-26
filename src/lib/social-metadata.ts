import type { Metadata } from "next";

export const socialImage = {
  url: "/images/social-share-v1.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "NikahCanada. Serious about Nikah? A thoughtful path to marriage, with faith, family, and sincere intentions.",
};

export function socialMetadata(title: string, description: string, path: string): Pick<Metadata, "openGraph" | "twitter"> {
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
