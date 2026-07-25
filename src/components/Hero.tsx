import Image from "next/image";
import { hero, trust } from "@/content/site";
import { Button, Eyebrow, Tick } from "@/components/ui";

/* The five assurances sit where invented statistics would normally go.
   They are the strongest true things the service can say up front. */
export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-ink px-6 lg:px-10">
      {/* Photographic ground. Two scrims: a flat one to hold overall contrast,
          then a left-to-right gradient so the copy side stays darkest while the
          domes remain readable behind the arch. */}
      <div aria-hidden className="absolute inset-0">
        <Image
          src="/images/hero-bg.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-ink/[0.86]" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/40" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-0 h-[720px] w-[720px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #B8894A55 0%, transparent 68%)" }}
      />
      {/* Khatam texture. Masked so it clears the centre where the copy and
          the arch sit — at full strength across the whole panel it reads as
          wallpaper and fights the headline. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.045]"
        style={{
          maskImage:
            "radial-gradient(115% 85% at 50% 34%, transparent 34%, #000 82%)",
          WebkitMaskImage:
            "radial-gradient(115% 85% at 50% 34%, transparent 34%, #000 82%)",
        }}
      >
        <defs>
          <pattern id="hero-khatam" width="52" height="52" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#F3EDE1" strokeWidth="0.8" transform="translate(26 26)">
              <rect x="-12" y="-12" width="24" height="24" />
              <rect x="-12" y="-12" width="24" height="24" transform="rotate(45)" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-khatam)" />
      </svg>

      <div className="shell relative pb-16 pt-36 lg:pb-20 lg:pt-44">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_440px] lg:gap-20">
          <div className="flex flex-col items-start gap-8">
            <Eyebrow onDark>{hero.eyebrow}</Eyebrow>

            <h1 className="max-w-[620px] text-[44px] leading-[1.06] tracking-[-1.2px] text-cream sm:text-[60px] xl:text-d1">
              {hero.title}
            </h1>

            <p className="max-w-[520px] text-lead text-body-dark">{hero.body}</p>

            <div className="flex flex-wrap items-center gap-3">
              <Button href={hero.primary.href} variant="onDark">
                {hero.primary.label}
              </Button>
              <Button href={hero.secondary.href} variant="outlineDark">
                {hero.secondary.label}
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[440px]">
            <div className="arch relative aspect-[440/560] w-full overflow-hidden ring-1 ring-white/12">
              <Image
                src={hero.image.src}
                alt={hero.image.alt}
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 440px"
                className="photo-warm object-cover"
              />
            </div>
            <div
              aria-hidden
              className="arch pointer-events-none absolute -left-5 -top-5 h-full w-full border border-brass/30"
            />
          </div>
        </div>

        <ul className="mt-16 grid gap-x-10 gap-y-4 border-t border-white/12 pt-10 sm:grid-cols-2 lg:mt-24 lg:grid-cols-3">
          {trust.points.map((p) => (
            <li key={p} className="flex items-start gap-3">
              <Tick className="mt-1 h-5 w-5 shrink-0 text-brass-soft" />
              <span className="text-sm text-body-dark">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
