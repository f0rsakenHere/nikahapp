import Image from "next/image";
import { ART, video } from "@/content/home";
import { Reveal } from "./primitives/Reveal";
import { VideoPlay } from "./VideoPlay";

/* Full-bleed image band with the play control over it.

   The control is drawn rather than the template's PNG, and the lightbox is
   a plain <video> instead of magnific-popup — see VideoPlay. It goes live
   the moment `video.href` points at a real film. */
export function VideoBand() {
  return (
    <section
      className="bg-[length:auto] bg-center bg-no-repeat py-16 sm:py-24 xl:pb-[160px] xl:pt-[154px]"
      style={{ backgroundImage: `url(${ART}/video-section-background.png)` }}
    >
      <div className="shell-b">
        <Reveal className="relative">
          <Image
            src={video.poster.src}
            alt={video.poster.alt}
            width={video.poster.w}
            height={video.poster.h}
            sizes="(max-width: 1279px) 100vw, 1110px"
            className="h-auto w-full rounded-br-[50px] rounded-tl-[50px] object-cover"
          />
          <VideoPlay href={video.href} />
        </Reveal>
      </div>
    </section>
  );
}
