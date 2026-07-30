import type { ReactNode } from "react";

/* The three repeating text blocks in every content column, at the sizes the
   template computes to at desktop. Each steps down on small screens — the
   original just let a 50px heading run off the edge. */

/* .autorix-text — the peach Playfair kicker above a section heading */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <h5 className="mb-5 font-playfair text-[22px] leading-[18px] text-peach">
      <span>{children}</span>
    </h5>
  );
}

/* .about-us-content h2 / .contact-us-title — 50/58 Playfair 700 */
export function SectionHeading({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <h2
      id={id}
      className={
        "font-playfair font-bold text-black " +
        "text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] " +
        "xl:text-[50px] xl:leading-[58px] " +
        className
      }
    >
      {children}
    </h2>
  );
}

/* .aboutus-p — 22/30 Jost 300 in the mid grey */
export function Lead({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={
        "font-jost font-light text-text " +
        "text-[18px] leading-[28px] xl:text-[22px] xl:leading-[30px] " +
        className
      }
    >
      {children}
    </p>
  );
}
