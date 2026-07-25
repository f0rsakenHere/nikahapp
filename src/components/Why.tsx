import { why } from "@/content/site";
import { Eyebrow, stagger } from "@/components/ui";

/* "Why send us your profile?" — the live site's three pillars.
   Head is split title-left / lead-right so the section doesn't leave
   a dead column at desktop widths. */
export function Why() {
  return (
    <section id="why" className="bg-cream px-6 py-24 lg:px-10 lg:py-32">
      <div className="shell flex flex-col gap-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:items-end lg:gap-20">
          <div className="reveal flex flex-col gap-6">
            <Eyebrow>{why.eyebrow}</Eyebrow>
            <h2 className="max-w-[560px] text-[32px] leading-[1.12] tracking-[-0.6px] text-ink md:text-d2">
              {why.title}
            </h2>
          </div>
          <p className="reveal text-lead text-body lg:pb-2">{why.body}</p>
        </div>

        <ul className="reveal-group grid gap-x-14 gap-y-12 md:grid-cols-3">
          {why.pillars.map((p, i) => (
            <li key={p.title} className="flex flex-col gap-4" style={stagger(i)}>
              <span className="font-display text-[15px] text-brass">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="rule-fade h-px w-full" />
              <h3 className="text-d4 text-ink">{p.title}</h3>
              <p className="text-body text-body">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
