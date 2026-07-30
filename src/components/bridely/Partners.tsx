import { assurances } from "@/content/home";
import { Reveal } from "./primitives/Reveal";
import { Tick } from "./primitives/Icons";

/* The white panel that straddles the seam between the two sections above
   and below it — that overlap is the whole point of the element, so the
   negative margin survives at every width and only the amount changes.

   The template filled it with eight partner brand logos. NikahCanada has
   no partner brands, so it carries the five assurances from the live
   site's hero strip instead. */
export function Partners() {
  return (
    <div className="relative z-[1] -mt-16 xl:-mt-[152px]">
      <div className="shell-b">
        <Reveal>
          <ul className="grid overflow-hidden rounded-[28px] border border-accent bg-white shadow-[0_6px_38px_0_#dae0e5] sm:grid-cols-2 xl:grid-cols-5 xl:rounded-[54px]">
            {assurances.map((line, i) => (
              <li
                key={line}
                className={
                  "flex items-center gap-3 px-6 py-5 xl:flex-col xl:gap-3 xl:px-5 xl:py-9 xl:text-center " +
                  "border-soft-green " +
                  // hairlines between cells, never on the outer edge
                  (i < assurances.length - 1 ? "border-b sm:border-b " : "") +
                  (i % 2 === 0 ? "sm:border-r " : "sm:border-r-0 ") +
                  "xl:border-b-0 xl:border-r " +
                  (i === assurances.length - 1 ? "xl:border-r-0" : "")
                }
              >
                <Tick className="h-5 w-5 shrink-0 text-accent" />
                <span className="font-jost text-[15px] leading-[22px] text-text xl:text-[16px]">
                  {line}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </div>
  );
}
