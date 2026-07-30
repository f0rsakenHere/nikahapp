import Image from "next/image";
import type { ReactNode } from "react";

/* The 255x220 white card used by both Categories and Organizers.

   Bootstrap's own `.card` supplied the 4px radius and the 1px hairline;
   the template only added the drop shadow and its hover. Keeping the card
   a fixed 255px wide is what lets the desktop collage sit on exact pixel
   offsets — it goes fluid below xl. */
export function PhotoCard({
  src,
  alt,
  label,
  overlay,
  className = "",
}: {
  src: string;
  alt: string;
  label: string;
  overlay?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "group relative flex flex-col overflow-hidden rounded-[4px] " +
        "border border-black/[0.125] bg-white " +
        "shadow-[0_4px_8px_0_rgba(0,0,0,0.2)] transition-shadow duration-300 " +
        "hover:shadow-[0_8px_16px_0_rgba(0,0,0,0.2)] " +
        className
      }
    >
      <div className="relative aspect-[255/220] w-full overflow-hidden">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1279px) 45vw, 255px"
          className="object-cover"
        />
        {overlay}
      </div>
      <h6 className="px-2 py-[10px] text-center font-playfair text-[20px] leading-[26px] text-black">
        {label}
      </h6>
    </div>
  );
}
