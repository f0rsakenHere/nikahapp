import Image from "next/image";
import { ART, reservation } from "@/content/home";
import { PillButton } from "./primitives/PillButton";
import { Reveal } from "./primitives/Reveal";
import { ReservationFlourish } from "./primitives/Decor";

/* Centred heading over a three-image collage: one tall frame on the left,
   two stacked on the right, 30px between them. */
export function Reservation() {
  const [tall, top, bottom] = reservation.images;

  return (
    <section
      id="fee"
      className="relative overflow-hidden bg-cover bg-center py-20 sm:py-28 xl:py-[160px]"
      style={{ backgroundImage: `url(${ART}/reservation-background.jpg)` }}
    >
      <ReservationFlourish />

      <div className="shell-b relative text-center">
        <Image
          src={`${ART}/reservation-logo.png`}
          alt=""
          width={166}
          height={99}
          aria-hidden
          className="mx-auto mb-6 h-auto w-[120px] xl:mb-[34px] xl:w-[166px]"
        />

        <h2 className="mx-auto mb-5 max-w-[900px] font-playfair text-[32px] font-bold leading-[40px] text-black sm:text-[40px] sm:leading-[48px] xl:mb-6 xl:px-[30px] xl:text-[50px] xl:leading-[58px]">
          {reservation.title}
        </h2>

        <p className="mx-auto mb-10 max-w-[720px] font-jost text-[18px] font-light leading-[28px] text-text xl:mb-[50px] xl:text-[22px] xl:leading-[30px]">
          {reservation.body}
        </p>

        <Reveal className="grid gap-[30px] lg:grid-cols-[635fr_445fr]">
          <Image
            src={tall.src}
            alt={tall.alt}
            width={tall.w}
            height={tall.h}
            sizes="(max-width: 1279px) 100vw, 635px"
            className="h-full max-h-[540px] w-full rounded-bl-[50px] rounded-tl-[50px] object-cover"
          />
          <div className="grid gap-[30px]">
            <Image
              src={top.src}
              alt={top.alt}
              width={top.w}
              height={top.h}
              sizes="(max-width: 1279px) 100vw, 445px"
              className="h-full max-h-[300px] w-full rounded-tr-[50px] object-cover"
            />
            <Image
              src={bottom.src}
              alt={bottom.alt}
              width={bottom.w}
              height={bottom.h}
              sizes="(max-width: 1279px) 100vw, 445px"
              className="h-full max-h-[210px] w-full rounded-br-[50px] object-cover"
            />
          </div>
        </Reveal>

        <div className="mt-12 xl:mt-[81px]">
          <PillButton href={reservation.cta.href}>{reservation.cta.label}</PillButton>
          <p className="mx-auto mt-6 max-w-[560px] font-jost text-[15px] leading-[24px] text-text/80">
            {reservation.note}
          </p>
        </div>
      </div>
    </section>
  );
}
