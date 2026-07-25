import { fee } from "@/content/site";
import { Button, SectionHead, stagger } from "@/components/ui";

/* No price cards, because the live site publishes no amount here.
   Instead this explains *when* the fee falls due — which is the part
   that actually reassures people, and which we can state truthfully. */
export function Fee() {
  return (
    <section id="fee" className="bg-shell px-6 py-24 lg:px-10 lg:py-32">
      <div className="shell flex flex-col items-center gap-16">
        <SectionHead
          eyebrow={fee.eyebrow}
          title={fee.title}
          body={fee.body}
          center
          className="reveal"
        />

        <ol className="reveal-group grid w-full items-stretch gap-6 md:grid-cols-3">
          {fee.points.map((p, i) => {
            const last = i === fee.points.length - 1;
            return (
              <li
                key={p.title}
                className={`flex flex-col gap-3 rounded-lg p-8 ${
                  last ? "bg-ink text-cream ring-1 ring-brass/40" : "border border-line bg-cream"
                }`}
                style={stagger(i)}
              >
                <span
                  className={`font-display text-[15px] ${last ? "text-brass-soft" : "text-brass"}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className={`text-d4 ${last ? "text-cream" : "text-ink"}`}>{p.title}</h3>
                <p className={`text-sm ${last ? "text-body-dark" : "text-body"}`}>{p.body}</p>
              </li>
            );
          })}
        </ol>

        <p className="reveal max-w-[620px] text-center text-body text-body">{fee.note}</p>

        <Button href={fee.cta.href} variant="solid">
          {fee.cta.label}
        </Button>
      </div>
    </section>
  );
}
