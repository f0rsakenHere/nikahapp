import Image from "next/image";
import { brand } from "@/content/home";

/* The real NikahCanada mark.
 *
 * The file is supplied white — meant for a dark background. Most of this
 * product is not dark, so the light-background rendering is the same
 * file inverted in CSS: a pure-white monochrome mark inverts to a
 * pure-black one exactly, and `invert()` leaves the transparency alone.
 * Nothing is redrawn and nothing is guessed. A proper dark asset would
 * still be better — it would allow a brand colour rather than black —
 * and dropping one in means changing `src` here and nowhere else.
 *
 * Two crops of the same artwork, cut at its own alpha boundaries by
 * scripts/brand-crop.cjs rather than by eye:
 *   `full`  — the script and "A Halal Matrimony Service"
 *   `mark`  — the script alone
 * The tagline is set small in the original, so at the ~28px a header
 * gives it, it renders about three pixels tall and turns to mush. `mark`
 * is the default for that reason; `full` is for places with room.
 *
 * The rings are gone as of the August artwork, and they were doing work
 * nobody replaced: `mark` used to be 1282×248 and is now 1282×163, so at
 * any fixed CSS height it is half again as wide. Every call site sets a
 * height and lets the width follow, which is why that is a layout change
 * and not just a swap — see the header, where it is the widest thing on
 * a 320px screen. */

const ART = {
  full: { src: "/brand/nikahcanada-lockup-white.png", width: 1282, height: 238 },
  mark: { src: "/brand/nikahcanada-wordmark-white.png", width: 1282, height: 163 },
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
      /* `object-contain` is load-bearing, not decoration. Preflight puts
         `max-width:100%` on every image, and with `w-auto` and a height
         utility that does not scale a too-wide logo down — it clamps the
         width and leaves the height alone, so the wordmark comes out
         horizontally squashed. It did, in the footer at 320px, by 27%,
         and nothing in responsive-check could see it because a squashed
         logo does not overflow anything. `contain` makes it shrink
         instead of stretch, so the worst a cramped container can do now
         is make the mark small. */
      className={`w-auto object-contain ${tone === "dark" ? "[filter:invert(1)]" : ""} ${className}`}
    />
  );
}
