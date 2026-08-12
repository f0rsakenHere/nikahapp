import { socials, topBar } from "@/content/home";
import { SOCIAL_ICONS } from "./primitives/Icons";

/* Only accounts that actually exist — see the note on `socials`. */
const LIVE = socials.filter((s) => s.href);

/* The 36px mint strip above the header. The template used the left half
   for a phone number (commented out in its markup); this carries the
   Montreal/Canada line instead, which is published copy and needs no
   contact details we do not have. */
export function TopBar() {
  return (
    <div className="bg-accent py-1.5 text-white">
      {/* With no social row there is nothing to push against, so the note
          stays centred rather than sitting against the left rail with half
          the strip empty. */}
      <div
        className={
          "shell-b flex items-center justify-center gap-4" +
          (LIVE.length ? " sm:justify-between" : "")
        }
      >
        <p className="font-jost text-[13px] leading-[18px] sm:text-[15px]">{topBar.note}</p>

        {LIVE.length ? (
          <div className="hidden items-center sm:flex">
            <span className="font-jost text-[15px] leading-[18px]">{topBar.followLabel}</span>
            <ul className="ml-2.5 flex items-center gap-2">
              {LIVE.map(({ name, label, href }) => {
                const Icon = SOCIAL_ICONS[name];
                return (
                  <li key={name}>
                    <a
                      href={href!}
                      aria-label={label}
                      target="_blank"
                      rel="noopener noreferrer"
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
        ) : null}
      </div>
    </div>
  );
}
