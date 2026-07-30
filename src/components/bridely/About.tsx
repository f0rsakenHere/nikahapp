import Image from "next/image";
import { ART, about } from "@/content/home";
import { Eyebrow, Lead, SectionHeading } from "./primitives/Type";
import { PillButton } from "./primitives/PillButton";
import { Reveal } from "./primitives/Reveal";
import { Twinkle } from "./primitives/Twinkle";

/* "What We do, We do With Passion".

   The photo side is a three-image collage held together by negative
   margins: the second image pulls up 120px and left 122px off the first,
   the third pulls up 100px and sits 194px in. That only makes sense at the
   template's fixed 540px column, so below xl the three become a plain
   stack. */
export function About() {
  const [one, two, three] = about.images;

  return (
    <section id="about" className="pb-16 xl:pb-[90px]">
      <div className="shell-b">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-8 xl:gap-[30px]">
          <Reveal className="text-center xl:text-left">
            <Eyebrow>{about.eyebrow}</Eyebrow>
            <SectionHeading className="mb-5 xl:mb-[27px]">{about.title}</SectionHeading>
            <Lead className="mx-auto mb-7 max-w-[506px] xl:mx-0 xl:mb-[34px] xl:pr-[34px]">
              {about.body}
            </Lead>
            <PillButton href={about.cta.href} variant="outline">
              {about.cta.label}
            </PillButton>
          </Reveal>

          {/* ---- collage ---- */}
          <div className="relative z-[39] xl:-mt-[70px] xl:pl-[93px]">
            <Twinkle
              src={`${ART}/about-bird-icon.png`}
              width={100}
              height={113}
              className="pointer-events-none absolute -left-[43px] top-[70px] hidden xl:block"
            />

            <div className="mx-auto flex max-w-[445px] flex-col items-center gap-6 xl:mx-0 xl:block xl:max-w-none xl:gap-0">
              <Image
                src={one.src}
                alt={one.alt}
                width={one.w}
                height={one.h}
                sizes="(max-width: 1279px) 90vw, 445px"
                className="h-auto w-full rounded-bl-[50px] rounded-tr-[50px] object-cover xl:w-[445px]"
              />
              <Image
                src={two.src}
                alt={two.alt}
                width={two.w}
                height={two.h}
                sizes="(max-width: 1279px) 90vw, 285px"
                /* the only collage image the template gives a shadow to */
                className="h-auto w-full rounded-br-[50px] rounded-tl-[50px] object-cover drop-shadow-[10px_0_16px_#cccc] transition-transform duration-300 ease-in-out hover:scale-105 xl:-ml-[122px] xl:-mt-[120px] xl:w-[285px]"
              />
              <Image
                src={three.src}
                alt={three.alt}
                width={three.w}
                height={three.h}
                sizes="(max-width: 1279px) 90vw, 255px"
                className="h-auto w-full rounded-br-[50px] rounded-tl-[50px] object-cover xl:-mt-[100px] xl:ml-[194px] xl:w-[255px]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
