import { topBar } from "@/content/home";
import { SOCIAL_ICONS } from "./primitives/Icons";

/* The 36px mint strip above the header. The template used the left half
   for a phone number (commented out in its markup); this carries the
   Montreal/Canada line instead, which is published copy and needs no
   contact details we do not have. */
export function TopBar() {
  return (
    <div className="bg-accent py-1.5 text-white">
      <div className="shell-b flex items-center justify-center gap-4 sm:justify-between">
        <p className="font-jost text-[13px] leading-[18px] sm:text-[15px]">{topBar.note}</p>

        <div className="hidden items-center sm:flex">
          <span className="font-jost text-[15px] leading-[18px]">{topBar.followLabel}</span>
          <ul className="ml-2.5 flex items-center gap-2">
            {topBar.socials.map((name) => {
              const Icon = SOCIAL_ICONS[name];
              return (
                <li key={name}>
                  <a
                    href="#"
                    aria-label={name}
                    /* negative margin keeps the 24px layout box while the tappable
                       area grows to 32px — the bar is only 36px tall */
                    className="-m-1 flex h-8 w-8 items-center justify-center p-1 text-[13px] transition-opacity hover:opacity-70"
                  >
                    <Icon />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
