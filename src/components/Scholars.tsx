import Image from "next/image";
import { scholars } from "@/content/site";
import { Eyebrow, stagger, Tick } from "@/components/ui";

/* The dark anchor two thirds down the page. The scholar consultation is
   the service's strongest genuine credential, so it earns the weight. */
export function Scholars() {
  return (
    <section id="scholars" className="bg-ink px-6 py-24 lg:px-10 lg:py-32">
      <div className="shell grid items-center gap-14 lg:grid-cols-[420px_1fr] lg:gap-20">
        <div className="relative mx-auto w-full max-w-[420px]">
          <div className="reveal-arch arch relative aspect-[420/520] w-full overflow-hidden ring-1 ring-white/12">
            <Image
              src={scholars.image.src}
              alt={scholars.image.alt}
              fill
              sizes="(max-width: 1024px) 85vw, 420px"
              className="photo-warm object-cover"
            />
          </div>
          <div
            aria-hidden
            className="arch pointer-events-none absolute -bottom-5 -right-5 h-full w-full border border-brass/25"
          />
        </div>

        <div className="flex flex-col gap-8">
          <div className="reveal">
            <Eyebrow onDark>{scholars.eyebrow}</Eyebrow>
          </div>

          <h2 className="reveal max-w-[520px] text-[32px] leading-[1.12] tracking-[-0.6px] text-cream md:text-d2">
            {scholars.title}
          </h2>

          <p className="reveal max-w-[560px] text-lead text-body-dark">{scholars.body}</p>

          <ul className="reveal-group flex flex-col gap-3.5">
            {scholars.measures.map((m, i) => (
              <li key={m} className="flex items-start gap-3" style={stagger(i)}>
                <Tick className="mt-1 h-5 w-5 shrink-0 text-brass-soft" />
                <span className="text-body text-cream/85">{m}</span>
              </li>
            ))}
          </ul>

          <blockquote className="reveal max-w-[560px] border-l-2 border-brass/50 pl-6 font-display text-[22px] leading-[1.38] text-brass-soft">
            &ldquo;{scholars.quote}&rdquo;
          </blockquote>
        </div>
      </div>
    </section>
  );
}
