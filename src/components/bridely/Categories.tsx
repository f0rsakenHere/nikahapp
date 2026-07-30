import Image from "next/image";
import { ART, categories } from "@/content/home";
import { Lead, SectionHeading } from "./primitives/Type";
import { PillButton } from "./primitives/PillButton";
import { Reveal } from "./primitives/Reveal";
import { Twinkle } from "./primitives/Twinkle";
import { CardCollage } from "./primitives/CardCollage";
import { RuledPaper } from "./primitives/Decor";

/* Mint section with the mandala mark floating 125px above the heading and
   the four product cards staggered down the right. */
export function Categories() {
  return (
    <section
      id="process"
      className="relative overflow-hidden bg-mist py-20 sm:py-28 xl:pb-[190px] xl:pt-[384px]"
    >
      <Twinkle
        src={`${ART}/categories-img1.png`}
        width={139}
        height={100}
        className="pointer-events-none absolute left-[25px] top-[100px] hidden xl:block"
      />

      <div className="shell-b">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center lg:gap-8 xl:items-start xl:gap-[30px]">
          <Reveal className="relative text-center">
            <RuledPaper />
            <Image
              src={`${ART}/categories-logo-img.png`}
              alt=""
              width={150}
              height={94}
              aria-hidden
              className="mx-auto mb-6 h-auto w-[110px] xl:absolute xl:left-1/2 xl:top-[-125px] xl:mb-0 xl:w-[150px] xl:-translate-x-1/2"
            />
            <SectionHeading className="mb-5 xl:mb-6">{categories.title}</SectionHeading>
            <Lead className="mb-7 px-2 xl:mb-9 xl:px-5">{categories.body}</Lead>
            <PillButton href={categories.cta.href} variant="outline">
              {categories.cta.label}
            </PillButton>
          </Reveal>

          <CardCollage
            cards={categories.cards}
            offsets={[
              [-222, 0],
              [-180, 287],
              [82, 0],
              [122, 287],
            ]}
          />
        </div>
      </div>
    </section>
  );
}
