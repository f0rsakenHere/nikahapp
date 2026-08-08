import type { ReactNode } from "react";

const W = 390;
const H = 780;
const BEZEL = 12; // matches p-3 on the frame

/* A numbered callout pinned over a screen. x/y are percentages of the
   screen area (not the frame), so they stay put at any scale. */
export type Pin = { n: number; x: number; y: number };

/* A device frame. Screens are authored at a true 390×780 and scaled down
   for display, so type and spacing stay honest rather than being
   redesigned for a thumbnail. */
export function Phone({
  children,
  scale = 0.78,
  pins,
}: {
  children: ReactNode;
  scale?: number;
  pins?: Pin[];
}) {
  const FRAME_W = W + BEZEL * 2;
  const FRAME_H = H + BEZEL * 2;

  /* Scale lives in a CSS variable (--ps) so it can drop on small screens
     without the component re-rendering. See .phone-frame in globals.css. */
  return (
    <div
      className="phone-frame relative"
      style={
        {
          "--ps-lg": scale,
          width: `calc(${FRAME_W}px * var(--ps))`,
          height: `calc(${FRAME_H}px * var(--ps))`,
        } as React.CSSProperties
      }
    >
      <div
        style={{
          transform: "scale(var(--ps))",
          transformOrigin: "top left",
          /* The bezel is a plain block, so without an explicit width here it
             inherits the scaled container's width and ends up NARROWER than
             the 390px screen it contains — which then overflows and covers
             the frame on the right and bottom. */
          width: FRAME_W,
        }}
      >
        <div className="rounded-[52px] bg-black p-3 shadow-[0_30px_60px_-25px_rgba(20,18,18,0.45)] ring-1 ring-white/10">
          {/* Flex column, so a screen's `h-full` means "the space left under
              the status bar" rather than the full 780. `font-jost` is set
              here rather than inherited: every screen inside is UI copy in
              the site's sans, and only titles opt back into Playfair. */}
          <div
            className="relative flex flex-col overflow-hidden rounded-[42px] bg-white font-jost"
            style={{ width: W, height: H }}
          >
            <StatusBar />
            <div className="relative min-h-0 flex-1">{children}</div>
          </div>
        </div>
      </div>

      {pins?.map((p) => (
        <span
          key={p.n}
          aria-hidden
          className="absolute z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-peach-deep font-jost text-[13px] font-semibold text-white"
          style={{
            left: `calc(${BEZEL + (p.x / 100) * W}px * var(--ps))`,
            top: `calc(${BEZEL + (p.y / 100) * H}px * var(--ps))`,
            /* The halo has to punch out of the section ground, which
               alternates white and mist down the page — so the colour comes
               from the section rather than being hard-coded here. */
            boxShadow: "0 0 0 4px var(--pin-ring, #fff)",
          }}
        >
          {p.n}
        </span>
      ))}
    </div>
  );
}

export const PHONE_WIDTH = (scale = 0.78) => (W + BEZEL * 2) * scale;

function StatusBar() {
  return (
    <div className="flex h-12 items-center justify-between px-7 pt-2 text-[13px] font-semibold text-black">
      <span>9:41</span>
      <div className="flex items-center gap-1.5" aria-hidden>
        <svg viewBox="0 0 18 12" className="h-3 w-4 fill-current">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" opacity="0.35" />
        </svg>
        <svg viewBox="0 0 16 12" className="h-3 w-4 fill-current">
          <path d="M8 11.2l2.2-2.7a3.4 3.4 0 00-4.4 0L8 11.2z" />
          <path
            d="M8 5.6c1.6 0 3.1.6 4.2 1.6l1.4-1.7A8.4 8.4 0 008 3.2 8.4 8.4 0 002.4 5.5l1.4 1.7A6.3 6.3 0 018 5.6z"
            opacity="0.9"
          />
        </svg>
        <svg viewBox="0 0 26 12" className="h-3 w-6">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.5" />
          <rect x="2" y="2" width="17" height="8" rx="1.8" fill="currentColor" />
          <rect x="24" y="4" width="2" height="4" rx="1" fill="currentColor" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

/* Home indicator, for screens without a bottom bar. */
export function HomeBar() {
  return (
    <div className="absolute inset-x-0 bottom-0 flex h-6 items-center justify-center">
      <span className="h-1 w-32 rounded-full bg-black/25" />
    </div>
  );
}
