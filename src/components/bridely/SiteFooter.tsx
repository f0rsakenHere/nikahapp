import Image from "next/image";
import Link from "next/link";
import { ART, brand, footer, socials } from "@/content/home";
import { PillButton } from "./primitives/PillButton";
import { Twinkle } from "./primitives/Twinkle";
import { FooterScroll } from "./primitives/Decor";
import { CaretRight, ClipboardList, Facebook, Instagram } from "./primitives/Icons";
import { Logo } from "@/components/brand/Logo";

/* Brand colour and glyph per account; the URLs live with the rest of the
   copy in content/home. Only accounts that exist are rendered. */
const CHROME = {
  facebook: { Icon: Facebook, bg: "bg-facebook" },
  instagram: { Icon: Instagram, bg: "bg-gmail" },
} as const;

const LIVE = socials.filter((s) => s.href);

/* Closing band: the "Send us your profile" row, then the brand pill and
   two link columns. The pill is a 240px-radius mint capsule pulled 128px
   up so it overlaps the row above it.

   The template also carried a phone number and an email here. Both were
   invented for its demo and nothing real has been supplied for
   NikahCanada, so the block is omitted rather than filled with something
   made up. Add real details and it comes back. */
export function SiteFooter() {
  const titles = [footer.columnTitle, footer.secondColumnTitle];

  return (
    <footer className="relative overflow-hidden py-16 xl:py-[100px]">
      <FooterScroll />
      <Twinkle
        src={`${ART}/footer-birds-img.png`}
        width={139}
        height={100}
        className="pointer-events-none absolute left-[29px] top-[175px] hidden xl:block"
      />
      <Image
        src={`${ART}/footer-chat-img.png`}
        alt=""
        width={110}
        height={110}
        aria-hidden
        className="pointer-events-none absolute right-[36px] top-[260px] hidden xl:block"
      />

      <div className="shell-b">
        {/* ---- closing row ---- */}
        <div className="mb-16 flex flex-col items-center gap-6 text-center xl:mb-[190px] xl:flex-row xl:justify-between xl:px-[95px] xl:text-left">
          <h3 className="font-playfair text-[30px] font-bold leading-[40px] text-black sm:text-[34px] xl:text-[40px] xl:leading-[46px]">
            {footer.planning}
          </h3>
          <div className="flex flex-wrap justify-center gap-3.5">
            <PillButton href={footer.primary.href} icon={<ClipboardList />}>
              {footer.primary.label}
            </PillButton>
            <PillButton href={footer.secondary.href} variant="outline">
              {footer.secondary.label}
            </PillButton>
          </div>
        </div>

        {/* ---- columns ---- */}
        <div className="grid gap-12 xl:grid-cols-[434px_1fr_1fr] xl:gap-[30px]">
          {/* brand pill */}
          <div className="mx-auto w-full max-w-[434px] rounded-[240px] bg-mist px-[50px] pb-[49px] pt-[60px] text-center xl:-mt-[128px] xl:pt-[110px]">
            <Link href="/" className="inline-block" aria-label={`${brand.name} home`}>
              <Logo variant="full" className="mx-auto h-16" />
            </Link>
            <p className="mb-[22px] mt-5 font-jost text-[17px] font-light leading-[30px] text-text xl:text-[18px]">
              {footer.blurb}
            </p>
            {LIVE.length ? (
              <ul className="flex justify-center gap-[5px]">
                {LIVE.map(({ name, label, href }) => {
                  const { Icon, bg } = CHROME[name];
                  return (
                    <li key={name}>
                      <a
                        href={href!}
                        aria-label={label}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex h-[33px] w-[33px] items-center justify-center rounded-full text-[12px] text-white transition-transform hover:-translate-y-0.5 ${bg}`}
                      >
                        <Icon />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {/* link columns */}
          {footer.columns.map((col, i) => (
            <div key={titles[i]} className={i === 0 ? "xl:pl-[70px]" : ""}>
              <p className="mb-[30px] font-jost text-[22px] font-semibold uppercase leading-[26px] text-black">
                {titles[i]}
              </p>
              <ul className="space-y-1 xl:space-y-4">
                {col.map((link) => (
                  <li key={link.label} className="flex items-center gap-2">
                    <CaretRight className="shrink-0 text-[11px] text-accent" />
                    <Link
                      href={link.href}
                      /* 18px of text is not a tap target; the padding comes
                         back out of the list spacing so the desktop rhythm
                         is unchanged */
                      className="block py-1.5 font-jost text-[18px] font-light leading-[18px] text-text transition-colors hover:text-accent xl:py-0"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 border-t border-soft-green pt-6 text-center xl:mt-[60px] xl:flex-row xl:justify-between xl:text-left">
          <p className="font-jost text-[16px] font-light leading-[18px] text-text">
            {footer.copyright}
          </p>
          <ul className="flex gap-6">
            {footer.legal.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="inline-block py-1 font-jost text-[15px] font-light text-text/70 transition-colors hover:text-accent"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
