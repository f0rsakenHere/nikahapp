import Image from "next/image";

const artwork = {
  discover: "/images/app/discover.webp",
  conversations: "/images/app/conversations.webp",
  review: "/images/app/review.webp",
  profile: "/images/app/profile.webp",
  requests: "/images/app/requests.webp",
  privacy: "/images/app/privacy.webp",
  notifications: "/images/app/notifications.webp",
} as const;

export type AppIllustrationKind = keyof typeof artwork;

const dimensions = {
  small: { className: "h-16 w-16", sizes: "64px" },
  compact: { className: "h-28 w-28", sizes: "112px" },
  standard: { className: "h-40 w-40", sizes: "160px" },
} as const;

/** Decorative artwork; the adjacent copy always explains the state. */
export function AppIllustration({
  kind,
  compact = false,
  size,
  className = "",
}: {
  kind: AppIllustrationKind;
  compact?: boolean;
  size?: keyof typeof dimensions;
  className?: string;
}) {
  const display = dimensions[size ?? (compact ? "compact" : "standard")];
  return (
    <Image
      src={artwork[kind]}
      alt=""
      aria-hidden="true"
      width={512}
      height={512}
      sizes={display.sizes}
      className={`${display.className} shrink-0 object-contain ${className}`}
    />
  );
}
