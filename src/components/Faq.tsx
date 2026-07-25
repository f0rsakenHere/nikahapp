import { faq } from "@/content/site";
import { SectionHead } from "@/components/ui";

/* Native <details> — keyboard accessible, works with JS disabled.
   The first item is open so the section never reads as a wall of rules. */
export function Faq() {
  return (
    <section id="faq" className="bg-cream px-6 py-24 lg:px-10 lg:py-32">
      <div className="shell grid gap-14 lg:grid-cols-[380px_1fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead eyebrow={faq.eyebrow} title={faq.title} />
        </div>

        <div className="flex flex-col">
          {faq.items.map((item, i) => (
            <details
              key={item.q}
              open={i === 0}
              className="group border-b border-line py-6 first:border-t"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-8">
                <span className="font-display text-[21px] leading-snug text-ink">{item.q}</span>
                <span className="relative mt-1.5 h-4 w-4 shrink-0 text-brass">
                  <span className="absolute left-0 top-1/2 h-px w-4 -translate-y-1/2 bg-current" />
                  <span className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-current transition-transform group-open:scale-y-0" />
                </span>
              </summary>
              <p className="mt-4 max-w-[640px] text-body text-body">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
