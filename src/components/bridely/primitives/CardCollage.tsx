import type { ReactNode } from "react";
import { PhotoCard } from "./PhotoCard";
import { Reveal } from "./Reveal";

export type CollageCard = {
  src: string;
  alt: string;
  label: string;
  overlay?: ReactNode;
};

/* The staggered four-card block used by both Categories and Organizers.

   At xl the cards are absolutely placed on the template's exact offsets,
   measured from the row edge (15px outside the column's content box) — that
   overhang is what lets the first card sit clear of the section's top
   padding. Below xl they become an ordinary two-up grid. */
export function CardCollage({ cards, offsets }: { cards: CollageCard[]; offsets: [number, number][] }) {
  return (
    <div className="relative">
      {/* under xl: plain grid */}
      <div className="grid grid-cols-2 gap-4 sm:gap-[30px] xl:hidden">
        {cards.map((c, i) => (
          <Reveal key={c.label} delay={i * 0.06}>
            <PhotoCard {...c} className="h-full" />
          </Reveal>
        ))}
      </div>

      {/* xl and up: the exact collage */}
      <div className="hidden xl:block">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className="absolute w-[257px]"
            style={{ top: offsets[i][0], left: offsets[i][1] - 15 }}
          >
            <Reveal delay={i * 0.06}>
              <PhotoCard {...c} />
            </Reveal>
          </div>
        ))}
      </div>
    </div>
  );
}
