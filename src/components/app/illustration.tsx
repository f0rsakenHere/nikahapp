import Image from "next/image";

const artwork = {
  discover: "/images/app/discover.webp",
  conversations: "/images/app/conversations.webp",
  review: "/images/app/review.webp",
} as const;

/** Decorative artwork; the adjacent copy always explains the state. */
export function AppIllustration({
  kind,
  compact = false,
  className = "",
}: {
  kind: keyof typeof artwork;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={artwork[kind]}
      alt=""
      aria-hidden="true"
      width={512}
      height={512}
      sizes={compact ? "112px" : "160px"}
      className={`${compact ? "h-28 w-28" : "h-40 w-40"} shrink-0 object-contain ${className}`}
    />
  );
}
