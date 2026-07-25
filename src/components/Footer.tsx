import { brand, footer } from "@/content/site";
import { Mark } from "@/components/ui";

/* The live site carries its legal links in English and French; both
   sets are kept here. */
export function Footer() {
  return (
    <footer id="contact" className="border-t border-line bg-shell px-6 pb-12 pt-16 lg:px-10">
      <div className="shell flex flex-col gap-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div className="flex max-w-[360px] flex-col gap-5">
            <a
              href="/"
              className="flex w-fit items-center gap-2.5 text-ink transition-colors hover:text-brass"
            >
              <Mark className="h-8 w-8 text-brass" />
              <span className="font-display text-[22px] tracking-[-0.3px]">{brand.name}</span>
            </a>
            <p className="text-sm text-body">{footer.blurb}</p>
            <a
              href="/how-it-works"
              className="text-sm font-semibold text-brass transition-colors hover:text-ink"
            >
              How it works, step by step →
            </a>
          </div>

          <div className="grid gap-10 sm:grid-cols-2">
            {footer.columns.map((col) => (
              <div key={col.title} className="flex flex-col gap-4">
                <h3 className="text-eyebrow uppercase text-body/50">{col.title}</h3>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-ink/70 transition-colors hover:text-brass"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line pt-6 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs text-body/60">{footer.copyright}</p>

          <ul className="flex gap-6">
            {footer.legal.map((l) => (
              <li key={l}>
                <a href="#" className="text-xs text-body/60 transition-colors hover:text-brass">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
