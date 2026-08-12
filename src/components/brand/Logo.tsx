import Image from "next/image";
import { brand } from "@/content/home";

/* The real NikahCanada mark.
 *
 * One file was supplied and it is white — meant for a dark background.
 * Most of this product is not dark, so the light-background rendering is
 * the same file inverted in CSS: a pure-white monochrome mark inverts to
 * a pure-black one exactly, and `invert()` leaves the transparency
 * alone. Nothing is redrawn and nothing is guessed. A proper dark asset
 * would still be better — it would allow a brand colour rather than
 * black — and dropping one in means changing `src` here and nowhere
 * else.
 *
 * Two crops of the same artwork, both cut from the supplied file at its
 * own alpha boundaries rather than by eye:
 *   `full`  — the script, the rings and "A Halal Matrimony Service"
 *   `mark`  — the script and the rings only
 * The tagline is set small in the original, so at the ~32px a header
 * gives it, it renders about three pixels tall and turns to mush. `mark`
 * is the default for that reason; `full` is for places with room.
 */

const ART = {
  full: { src: "/brand/nikahcanada-white.png", width: 1282, height: 323 },
  mark: { src: "/brand/nikahcanada-mark-white.png", width: 1282, height: 248 },
} as const;

export function Logo({
  variant = "mark",
  tone = "dark",
  className = "",
  priority,
}: {
  variant?: keyof typeof ART;
  /** The background it sits on, not the colour of the ink. */
  tone?: "dark" | "light";
  /** Set a height here; the width follows the artwork. */
  className?: string;
  priority?: boolean;
}) {
  const art = ART[variant];
  return (
    <Image
      src={art.src}
      alt={brand.name}
      width={art.width}
      height={art.height}
      priority={priority}
      className={`w-auto ${tone === "dark" ? "[filter:invert(1)]" : ""} ${className}`}
    />
  );
}
