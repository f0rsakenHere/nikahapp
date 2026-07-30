import { ART } from "@/content/home";

/* Five decorative layers the template drew as CSS `::before` / `::after`
   rules, so they never appear in its markup — the ruled paper behind three
   copy columns, the wash behind the banner, the reservation flourish, the
   organizer mandala and the footer scroll.

   They are pure ornament: hidden below xl, where they would only crowd a
   narrow column, and always aria-hidden. */

type DecorProps = { className?: string };

function Layer({
  src,
  width,
  height,
  className = "",
  style,
}: {
  src: string;
  width: number;
  height: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute hidden bg-no-repeat xl:block ${className}`}
      style={{
        width,
        height,
        backgroundImage: `url(${ART}/${src})`,
        ...style,
      }}
    />
  );
}

/* .categories-section / .event-org-section / .form-section
   `.about-us-content:before` — faint vertical rules behind the copy. */
export function RuledPaper({ className = "" }: DecorProps) {
  return (
    <Layer
      src="category-lines-img.png"
      width={555}
      height={940}
      className={`bottom-[-155px] right-0 -z-10 ${className}`}
    />
  );
}

/* .home-header-section::after — the wash behind the banner. */
export function BannerWash() {
  return (
    <Layer
      src="banner-right-img.png"
      width={555}
      height={890}
      className="bottom-[624px] right-[393px] -z-10"
    />
  );
}

/* .reservation-section:before */
export function ReservationFlourish() {
  return (
    <Layer
      src="reservation-before-img.png"
      width={391}
      height={624}
      className="left-[-78px] top-[350px]"
    />
  );
}

/* .event-org-section::after */
export function OrganizerMandala() {
  return (
    <Layer
      src="event-org-logo.png"
      width={391}
      height={624}
      className="bottom-[59px] right-[-80px]"
    />
  );
}

/* .footer-section::after */
export function FooterScroll() {
  return (
    <Layer
      src="footer-design-img.png"
      width={370}
      height={231}
      className="bottom-[-3px] right-[94px]"
    />
  );
}
