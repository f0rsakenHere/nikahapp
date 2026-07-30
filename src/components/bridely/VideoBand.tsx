import Image from "next/image";
import { ART, video } from "@/content/home";
import { Reveal } from "./primitives/Reveal";

/* Full-bleed image band.

   The template put a play button here that opened a stock clip in a
   lightbox. NikahCanada has no film, and a play control that plays
   nothing is worse than no control — so this is a still band until there
   is something real to put behind it. */
export function VideoBand() {
  return (
    <section
      className="bg-[length:auto] bg-center bg-no-repeat py-16 sm:py-24 xl:pb-[160px] xl:pt-[154px]"
      style={{ backgroundImage: `url(${ART}/video-section-background.png)` }}
    >
      <div className="shell-b">
        <Reveal>
          <Image
            src={video.poster.src}
            alt={video.poster.alt}
            width={video.poster.w}
            height={video.poster.h}
            sizes="(max-width: 1279px) 100vw, 1110px"
            className="h-auto w-full rounded-br-[50px] rounded-tl-[50px] object-cover"
          />
        </Reveal>
      </div>
    </section>
  );
}
