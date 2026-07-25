import { cta } from "@/content/site";
import { Button } from "@/components/ui";

/* Closing panel: an arch drawn in brass rule, the invitation inside it. */
export function Cta() {
  return (
    <section id="start" className="bg-shell px-6 pb-24 pt-24 lg:px-10 lg:pb-32 lg:pt-32">
      <div className="shell relative overflow-hidden rounded-lg bg-ink px-6 py-20 text-center lg:py-28">
        <svg
          aria-hidden
          viewBox="0 0 400 300"
          fill="none"
          className="pointer-events-none absolute left-1/2 top-0 h-full -translate-x-1/2 text-brass/20"
        >
          <path d="M40 300V150a160 160 0 01320 0v150" stroke="currentColor" strokeWidth="1.2" />
          <path d="M90 300V160a110 110 0 01220 0v140" stroke="currentColor" strokeWidth="1.2" />
          <path d="M140 300V172a60 60 0 01120 0v128" stroke="currentColor" strokeWidth="1.2" />
        </svg>

        <div className="reveal relative mx-auto flex max-w-[560px] flex-col items-center gap-7">
          <h2 className="text-[38px] leading-[1.08] tracking-[-1px] text-cream md:text-d1">
            {cta.title}
          </h2>
          <p className="text-lead text-body-dark">{cta.body}</p>
          <Button href={cta.primary.href} variant="onDark">
            {cta.primary.label}
          </Button>
          <p className="text-sm text-body-dark/60">{cta.note}</p>
        </div>
      </div>
    </section>
  );
}
