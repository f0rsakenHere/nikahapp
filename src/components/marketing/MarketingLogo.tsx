import Image from "next/image";

export function MarketingLogo({
  className = "",
  tone = "color",
  priority = false,
}: {
  className?: string;
  tone?: "color" | "white";
  priority?: boolean;
}) {
  return <Image src="/brand/nikahcanada-reference.webp" alt="NikahCanada" width={1200} height={303} priority={priority} className={`marketing-logo${tone === "white" ? " is-white" : ""} ${className}`} />;
}
