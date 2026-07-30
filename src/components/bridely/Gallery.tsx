import Image from "next/image";
import { ART, PHOTO, gallery } from "@/content/home";
import { Reveal } from "./primitives/Reveal";
import { Twinkle } from "./primitives/Twinkle";

/* Four squares over a photographic band pinned to the bottom of the
   section — the deep bottom padding is what leaves room for it.

   This was the template's Instagram feed. No account has been supplied,
   so the icon, the handle and the per-tile hover chips are gone and it
   reads as a plain closing band. Give us a handle and it can go back. */
export function Gallery() {
  return (
    <section className="relative overflow-hidden pb-64 pt-16 sm:pt-24 xl:pb-[618px] xl:pt-[104px]">
      {/* The template's placeholder here faded from white, so the photo is
          masked the same way at both edges rather than butting up against
          the page on a hard horizontal line. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0">
        <Image
          src={`${PHOTO}/insta-bg.jpg`}
          alt=""
          width={1920}
          height={1081}
          className="h-auto w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/45 to-white/10" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </div>

      <div className="shell-b relative">
        <Twinkle
          src={`${ART}/insta-bird-img.png`}
          width={100}
          height={113}
          className="pointer-events-none absolute left-[760px] top-[-14px] hidden xl:block"
        />

        <h2 className="mb-4 text-center font-playfair text-[32px] font-bold leading-[40px] text-black sm:text-[40px] xl:text-[50px] xl:leading-[58px]">
          {gallery.title}
        </h2>
        <p className="mx-auto mb-10 max-w-[620px] text-center font-jost text-[18px] font-light leading-[28px] text-text xl:mb-[60px] xl:text-[22px] xl:leading-[30px]">
          {gallery.body}
        </p>

        <ul className="grid grid-cols-2 gap-[30px] lg:grid-cols-4">
          {gallery.posts.map((post, i) => (
            <Reveal as="li" key={post.src} delay={i * 0.06}>
              <figure className="relative aspect-square overflow-hidden drop-shadow-[10px_0_16px_#cccc]">
                <Image
                  src={post.src}
                  alt={post.alt}
                  fill
                  sizes="(max-width: 1023px) 45vw, 255px"
                  className="object-cover"
                />
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
