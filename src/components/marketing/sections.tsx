import Link from "next/link";
import { closing, faq, hero, howItWorks, marks, why } from "@/content/landing";
import { ArrowIcon, ICONS, type IconName } from "./icons";

/* The homepage, in five movements.
 *
 * One rail (`shell`) holds every section to the same left edge, and the
 * page alternates ivory and mist grounds rather than drawing boxes
 * around things — the old homepage put a card around each of nine
 * sections, which flattened everything to the same importance.
 *
 * The arch is the one ornament. It is the shape of a mihrab reduced to
 * two lines, drawn in the hero and echoed nowhere else, so it reads as
 * this service's mark rather than as decoration sprinkled through.
 */

const shell = "mx-auto w-full max-w-[1180px] px-5 sm:px-8";

/* ------------------------------------------------------------- hero -- */

function Arch() {
  return (
    <svg
      viewBox="0 0 420 520"
      aria-hidden
      className="pointer-events-none absolute -right-20 top-0 hidden h-full w-auto text-soft-peach lg:block"
      preserveAspectRatio="xMaxYMid slice"
    >
      <defs>
        <linearGradient id="arch-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="0.7" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Three nested pointed arches — a mihrab reduced to its outline.
          Stroked, never filled, and drawn once on this page only, so it
          reads as a mark rather than as wallpaper. */}
      <path d="M36 520V250C36 132 118 44 210 22c92 22 174 110 174 228v270" fill="none" stroke="url(#arch-fade)" strokeWidth="1.4" />
      <path d="M92 520V268c0-92 54-164 118-182 64 18 118 90 118 182v252" fill="none" stroke="url(#arch-fade)" strokeWidth="1.4" />
      <path d="M148 520V288c0-62 28-110 62-122 34 12 62 60 62 122v232" fill="none" stroke="url(#arch-fade)" strokeWidth="1.4" />
    </svg>
  );
}

export function Hero({ signedIn }: { signedIn: boolean }) {
  const cta = signedIn ? hero.signedIn : hero.cta;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-mist/70 to-white">
      <Arch />
      <div className={`${shell} relative pb-12 pt-14 sm:pb-14 sm:pt-18 lg:pb-16 lg:pt-24`}>
        <div className="max-w-[640px]">
          <h1 className="font-playfair text-[clamp(2.75rem,8vw,4.5rem)] font-bold leading-[0.98] tracking-[-0.02em] text-black">
            <span className="block">{hero.question.plain}</span>
            <span className="block text-peach-deep">{hero.question.accent}</span>
          </h1>

          <p className="mt-6 font-playfair text-[clamp(1.5rem,4vw,2rem)] font-semibold leading-tight text-black">
            {hero.welcome}
          </p>
          <p className="mt-3 font-playfair text-[clamp(1.125rem,3vw,1.5rem)] italic leading-snug text-accent-deep">
            {hero.line}
          </p>

          <p className="mt-6 max-w-[46ch] font-jost text-[18px] leading-[28px] text-text">
            {hero.body}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href={cta.href}
              className="group inline-flex h-14 items-center gap-3 rounded-pill bg-peach pl-7 pr-6 font-jost text-[18px] font-semibold leading-none text-black transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-16px_rgba(156,66,45,0.85)]"
            >
              {cta.label}
              <ArrowIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            {signedIn ? null : (
              <Link
                href="/login"
                className="font-jost text-[18px] text-accent-deep underline-offset-4 hover:underline"
              >
                Already a member? Sign in
              </Link>
            )}
          </div>
        </div>

        <ul className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-soft-green pt-6">
          {marks.map((m) => {
            const Icon = ICONS[m.icon as IconName];
            return (
              <li key={m.label} className="flex items-center gap-2.5">
                <Icon className="h-5 w-5 text-peach-deep" />
                <span className="font-jost text-[18px] text-text">{m.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ----------------------------------------------------- how it works -- */

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 bg-white py-14 sm:py-20">
      <div className={shell}>
        <h2 className="font-playfair text-[clamp(2rem,5vw,2.75rem)] font-bold leading-tight tracking-[-0.02em] text-black">
          {howItWorks.title}
        </h2>

        <ol className="mt-10 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {howItWorks.steps.map((s) => {
            const Icon = ICONS[s.icon as IconName];
            return (
              <li key={s.n} className="relative">
                {/* The numeral rides the circle rather than sitting
                    beside it: two marks at the same size read as two
                    things, and the step is one. */}
                <div className="relative w-16">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-soft-peach/55 text-peach-deep">
                    <Icon className="h-8 w-8" />
                  </span>
                  <span className="absolute -left-2 -top-2 grid h-8 w-8 place-items-center rounded-full bg-peach font-jost text-[18px] font-semibold leading-none text-black">
                    {s.n}
                  </span>
                </div>
                <h3 className="mt-5 font-playfair text-[22px] font-bold leading-snug text-black">
                  {s.title}
                </h3>
                <p className="mt-2.5 max-w-[42ch] font-jost text-[18px] leading-[28px] text-text">
                  {s.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- why -- */

export function Why() {
  return (
    <section id="why" className="scroll-mt-20 bg-mist/70 py-16 sm:py-24">
      <div className={shell}>
        <div className="max-w-[640px]">
          <h2 className="font-playfair text-[clamp(2rem,5vw,2.75rem)] font-bold leading-tight tracking-[-0.02em] text-black">
            {why.title}
          </h2>
          <p className="mt-4 font-jost text-[18px] leading-[28px] text-text">{why.blurb}</p>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
          {why.points.map((p) => {
            const Icon = ICONS[p.icon as IconName];
            return (
              <li key={p.title}>
                <Icon className="h-7 w-7 text-accent-deep" />
                <h3 className="mt-4 font-jost text-[18px] font-semibold leading-snug text-black">
                  {p.title}
                </h3>
                <p className="mt-2 font-jost text-[18px] leading-[28px] text-text">{p.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- faq -- */

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-white py-16 sm:py-24">
      <div className={shell}>
        <h2 className="font-playfair text-[clamp(2rem,5vw,2.75rem)] font-bold leading-tight tracking-[-0.02em] text-black">
          {faq.title}
        </h2>

        <dl className="mt-10 grid grid-cols-1 gap-x-14 gap-y-8 lg:grid-cols-2">
          {faq.items.map((item) => (
            <div key={item.q} className="border-t border-soft-green pt-5">
              <dt className="font-jost text-[18px] font-semibold leading-none text-black">{item.q}</dt>
              <dd className="mt-2 max-w-[62ch] font-jost text-[18px] leading-[28px] text-text">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- closing -- */

export function Closing({ signedIn }: { signedIn: boolean }) {
  if (signedIn) return null;

  return (
    <section className="bg-mist/70 py-16 sm:py-20">
      <div className={`${shell} flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between`}>
        <div>
          <h2 className="font-playfair text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-tight tracking-[-0.02em] text-black">
            {closing.title}
          </h2>
          <p className="mt-3 max-w-[52ch] font-jost text-[18px] leading-[28px] text-text">
            {closing.body}
          </p>
        </div>
        <Link
          href={closing.cta.href}
          className="group inline-flex h-14 shrink-0 items-center gap-3 rounded-pill bg-peach pl-7 pr-6 font-jost text-[18px] font-semibold leading-none text-black transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-16px_rgba(156,66,45,0.85)]"
        >
          {closing.cta.label}
          <ArrowIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
