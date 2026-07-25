import { steps } from "@/content/site";
import { Button, Eyebrow, stagger } from "@/components/ui";

/* The six steps from the live site, as an editorial list rather than
   a row of cards — a serif numeral in an arch marker, then the copy. */
export function Steps() {
  return (
    <section id="steps" className="bg-shell px-6 py-24 lg:px-10 lg:py-32">
      <div className="shell flex flex-col gap-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:items-end lg:gap-20">
          <div className="reveal flex flex-col gap-6">
            <Eyebrow>{steps.eyebrow}</Eyebrow>
            <h2 className="max-w-[600px] text-[32px] leading-[1.12] tracking-[-0.6px] text-ink md:text-d2">
              {steps.title}
            </h2>
          </div>
          <p className="reveal text-lead text-body lg:pb-2">{steps.body}</p>
        </div>

        <ol className="reveal-group grid gap-x-16 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {steps.items.map((step, i) => (
            <li key={step.n} className="flex gap-6" style={stagger(i)}>
              <span className="arch-sm grid h-[68px] w-[56px] shrink-0 place-items-center border border-brass/35 bg-brass-tint/60 font-display text-[21px] text-brass">
                {step.n}
              </span>
              <div className="flex flex-col gap-2.5 pt-2">
                <h3 className="text-[21px] leading-snug text-ink" style={{ fontFamily: "var(--font-display)" }}>
                  {step.title}
                </h3>
                <p className="text-sm text-body">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <Button href={steps.cta.href} variant="outline" className="self-start">
          {steps.cta.label}
        </Button>
      </div>
    </section>
  );
}
