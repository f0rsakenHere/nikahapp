import { safety } from "@/content/site";
import { SectionHead } from "@/components/ui";

/* Six plain statements of how confidentiality actually works.
   Deliberately unadorned — the copy is the design here. */
export function Safety() {
  return (
    <section id="safety" className="bg-cream px-6 py-24 lg:px-10 lg:py-32">
      <div className="shell flex flex-col gap-16">
        <SectionHead eyebrow={safety.eyebrow} title={safety.title} body={safety.body} />

        <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
          {safety.items.map((item) => (
            <li
              key={item.title}
              className="flex flex-col gap-3 bg-cream p-8 transition-colors hover:bg-shell"
            >
              <h3 className="text-d4 text-ink">{item.title}</h3>
              <p className="text-sm text-body">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
