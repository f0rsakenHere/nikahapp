import { brand } from "@/content/home";

/* A typographic wordmark, standing in for the template's Bridely logo.

   No NikahCanada logo file has been supplied, and shipping the template's
   demo mark on a real business's site would be wrong on both branding and
   licensing grounds. This sets the name in the page's own display face so
   it reads as deliberate rather than missing.

   TODO: drop in the real logo and this component becomes an <Image>. */
export function Wordmark({
  className = "",
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span
      className={
        "inline-flex items-baseline font-playfair font-bold tracking-[-0.5px] " +
        (tone === "light" ? "text-white" : "text-black") +
        " " +
        className
      }
    >
      Nikah
      <span className="text-peach">Canada</span>
    </span>
  );
}

export const BRAND_NAME = brand.name;
