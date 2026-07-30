import Image from "next/image";
import { ART, PHOTO, eventTogether } from "@/content/home";
import { Lead, SectionHeading } from "./primitives/Type";
import { PillButton } from "./primitives/PillButton";
import { Reveal } from "./primitives/Reveal";
import { SAFEGUARD_ICONS } from "./primitives/SafeguardIcons";

/* Four service tiles in a 2x2 block sharing single hairlines, with the copy
   column on the right. The template drew the shared borders by switching
   individual sides off per cell; a grid with a background rule is the same
   picture without the per-cell bookkeeping. */
export function EventTogether() {
  return (
    <section
      id="scholars"
      className="relative overflow-hidden bg-cover bg-center bg-no-repeat py-20 sm:py-28 xl:pb-[158px] xl:pt-[162px]"
      style={{ backgroundImage: `url(${PHOTO}/event-bg.jpg)` }}
    >
      {/* the photo is a backdrop, so it gets a wash to keep the copy legible */}
      <div className="absolute inset-0 bg-white/[0.92]" aria-hidden />

      <div className="shell-b relative">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-8 xl:items-start xl:gap-[30px]">
          {/* ---- tiles (left at xl) ---- */}
          <Reveal className="xl:order-1">
            {/* the section's photographic ground would otherwise read
                straight through the tiles and fight the line icons */}
            <ul className="grid grid-cols-2 overflow-hidden border border-soft-green bg-white/90">
              {eventTogether.tiles.map((tile, i) => {
                const Icon = SAFEGUARD_ICONS[tile.icon];
                return (
                  <li
                    key={tile.label}
                    className={
                      "flex flex-col items-center pb-[30px] pt-5 " +
                      (i % 2 === 0 ? "border-r border-soft-green " : "") +
                      (i < 2 ? "border-b border-soft-green" : "")
                    }
                  >
                    <Icon className="h-auto w-[110px] text-accent xl:w-[149px]" />
                    <h6 className="mt-4 px-2 text-center font-playfair text-[17px] leading-[26px] text-black xl:mt-2 xl:text-[20px]">
                      {tile.label}
                    </h6>
                  </li>
                );
              })}
            </ul>
          </Reveal>

          {/* ---- copy (right at xl) ---- */}
          <Reveal className="relative text-center xl:order-2 xl:pt-[38px]">
            <Image
              src={`${ART}/event-design-logo.png`}
              alt=""
              width={150}
              height={94}
              aria-hidden
              className="mx-auto mb-6 h-auto w-[110px] xl:mb-8 xl:w-[150px]"
            />
            <SectionHeading className="mb-5 xl:mb-6">
              {eventTogether.title}
            </SectionHeading>
            <Lead className="mb-7 px-2 xl:mb-9 xl:px-5">
              {eventTogether.body}
            </Lead>
            <PillButton href={eventTogether.cta.href} variant="outline">
              {eventTogether.cta.label}
            </PillButton>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
