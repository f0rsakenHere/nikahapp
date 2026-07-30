import Image from "next/image";
import { ART, organizers } from "@/content/home";
import { Lead, SectionHeading } from "./primitives/Type";
import { PillButton } from "./primitives/PillButton";
import { Reveal } from "./primitives/Reveal";
import { Twinkle } from "./primitives/Twinkle";
import { CardCollage } from "./primitives/CardCollage";
import { OrganizerMandala, RuledPaper } from "./primitives/Decor";

/* Same mint ground and staggered collage as Categories, with the copy and
   cards swapped to opposite sides.

   The template made these four staff cards with names and social links.
   NikahCanada publishes no team, so they carry the confidentiality
   measures and the hover social row is gone — it implied a personal
   profile behind each card. */
export function Organizers() {
  const cards = organizers.people.map((p) => ({
    src: p.src,
    alt: p.alt,
    label: p.name,
  }));

  return (
    <section
      id="safety"
      className="relative overflow-hidden bg-mist py-20 sm:py-28 xl:pb-[190px] xl:pt-[384px]"
    >
      <OrganizerMandala />
      <Twinkle
        src={`${ART}/categories-img1.png`}
        width={139}
        height={100}
        className="pointer-events-none absolute right-[150px] top-[60px] hidden xl:block"
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
            <SectionHeading className="mb-5 xl:mb-[29px]">{organizers.title}</SectionHeading>
            <Lead className="mb-7 px-2 xl:mb-9 xl:px-5">{organizers.body}</Lead>
            <PillButton href={organizers.cta.href} variant="outline">
              {organizers.cta.label}
            </PillButton>
          </Reveal>

          <CardCollage
            cards={cards}
            offsets={[
              [-222, 0],
              [-180, 298],
              [82, 0],
              [125, 298],
            ]}
          />
        </div>
      </div>
    </section>
  );
}
