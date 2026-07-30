import Image from "next/image";
import { ART, hero } from "@/content/home";
import { PillButton } from "./primitives/PillButton";
import { Reveal } from "./primitives/Reveal";
import { Twinkle } from "./primitives/Twinkle";
import { ClipboardList } from "./primitives/Icons";
import { HeroTitle } from "./HeroTitle";

/* The banner. At xl the two columns land on the template's exact rails —
   540px each with a 30px gutter inside the 1110px container — and the photo
   hangs 76px above the row on a negative offset. Below xl the columns stack
   and the photo goes fluid. */
export function Hero() {
  return (
    <div className="relative overflow-hidden pb-24 pt-16 sm:pb-32 sm:pt-24 xl:pb-[238px] xl:pt-[200px]">
      {/* decorative flourishes — off-canvas on small screens */}
      <Twinkle
        src={`${ART}/banner-img1.png`}
        width={178}
        height={178}
        className="pointer-events-none absolute left-[-72px] top-[154px] hidden h-[178px] w-[178px] xl:block"
      />
      <Twinkle
        src={`${ART}/banner-img2.png`}
        width={248}
        height={235}
        className="pointer-events-none absolute right-[-12px] top-[538px] hidden h-[235px] w-[248px] xl:block"
      />

      <div className="shell-b">
        <div className="flex flex-col-reverse gap-12 lg:grid lg:grid-cols-2 lg:items-center lg:gap-8 xl:items-start xl:gap-[30px]">
          {/* ---- photo ---- */}
          <div className="relative">
            <Reveal className="xl:absolute xl:-left-[30px] xl:-top-[76px] xl:w-[570px]">
              <Image
                src={hero.image.src}
                alt={hero.image.alt}
                width={hero.image.w}
                height={hero.image.h}
                priority
                sizes="(max-width: 1279px) 90vw, 475px"
                /* drop-shadow + hover lift are the template's own
                   `.banner-img-content figure img` rules */
                className="mx-auto h-auto w-full max-w-[475px] rounded-tl-[100px] rounded-br-[50px] object-cover drop-shadow-[10px_0_16px_#cccc] transition-transform duration-300 ease-in-out hover:scale-105 xl:ml-[118px] xl:w-[475px] xl:max-w-none"
              />
            </Reveal>
          </div>

          {/* ---- copy ---- */}
          <Reveal className="relative text-center xl:mt-[74px] xl:pl-[44px] xl:text-left">
            <Image
              src={`${ART}/ring-icon-banner.png`}
              alt=""
              width={106}
              height={82}
              aria-hidden
              className="pointer-events-none absolute left-10 top-[-102px] hidden xl:block"
            />

            <HeroTitle title={hero.title} accent={hero.titleAccent} />

            <p className="mx-auto mb-8 max-w-[496px] font-jost text-[18px] font-light leading-[28px] text-text sm:text-[22px] sm:leading-[31px] xl:mx-0 xl:mb-11 xl:pr-6">
              {hero.body}
            </p>

            <PillButton href={hero.cta.href} icon={<ClipboardList />}>
              {hero.cta.label}
            </PillButton>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
