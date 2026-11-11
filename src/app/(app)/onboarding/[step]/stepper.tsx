import Link from "next/link";
import { Check, Lock } from "@/components/app/kit";
import type { StepId } from "@/lib/domain/profile";

export type StepperItem = {
  id: StepId;
  title: string;
  state: "done" | "current" | "open" | "locked";
};

/* The whole road, with you on it.
 *
 * Taken from a registration form the client pointed at: every step named
 * across the top, the finished ones ticked, the one you are on filled
 * in, the ones ahead greyed out. What it adds over "Step 2 of 4" is that
 * the steps ahead are visibly *shut* — which is the rule now, and a rule
 * nobody can see is one people walk into.
 *
 * Finished steps are links, so an answer can always be gone back to.
 * Steps ahead are not, because they do not open yet.
 *
 * On a phone the names are dropped and only the circles stay: four
 * titles at 18px do not fit across 360 pixels, and the line above
 * already names the step you are on. */
export function Stepper({ items }: { items: StepperItem[] }) {
  return (
    <ol
      aria-label="Profile steps"
      /* One column per step, the name under its circle. Beside it, four
         names at 18px wrapped to two lines each in a 560px column and
         squeezed the lines joining them down to dashes. */
      className="grid"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item, i) => {
        const circle = (
          <span
            className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[16px] font-semibold ${
              item.state === "done"
                ? "bg-peach text-black"
                : item.state === "current"
                  ? "bg-accent-deep text-white"
                  : item.state === "open"
                    ? "border-2 border-peach-deep bg-white text-peach-deep"
                    : "border border-dashed border-text/30 bg-white text-text/40"
            }`}
          >
            {item.state === "done" ? (
              <Check className="h-3.5 w-3.5" />
            ) : item.state === "locked" ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              i + 1
            )}
          </span>
        );

        const label = (
          <span
            className={`mt-2 hidden px-1 text-center text-[18px] leading-[22px] sm:block ${
              item.state === "current"
                ? "font-semibold text-black"
                : item.state === "locked"
                  ? "text-text/45"
                  : "text-text"
            }`}
          >
            {item.title}
          </span>
        );

        const linked = item.state === "done" || item.state === "open";

        return (
          <li
            key={item.id}
            className="relative flex min-w-0 flex-col items-center"
            aria-current={item.state === "current" ? "step" : undefined}
          >
            {/* The line to the next step, centre to centre, behind the
                circles. Peach once this step is done. */}
            {i < items.length - 1 ? (
              <span
                aria-hidden="true"
                className={`absolute left-1/2 top-4 h-px w-full ${
                  item.state === "done" ? "bg-peach" : "bg-soft-green"
                }`}
              />
            ) : null}
            {linked ? (
              <Link
                href={`/onboarding/${item.id}`}
                className="flex min-w-0 flex-col items-center underline-offset-2 hover:underline"
              >
                {circle}
                {label}
              </Link>
            ) : (
              <span className="flex min-w-0 flex-col items-center">
                {circle}
                {label}
                {item.state === "locked" ? <span className="sr-only">(not open yet)</span> : null}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
