"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  BrowseIcon,
  ChatIcon,
  HomeIcon,
  ProfileIcon,
  RequestsIcon,
} from "@/components/app/icons";

/* The tabs, and the highlight that moves between them.
 *
 * A client component for one reason: the highlight has to move when the
 * tab is *pressed*, not when the server has finished answering. A server
 * render can only ever show the destination once it has arrived, and on
 * a slow connection that is a second of a dead-looking sidebar followed
 * by the pill appearing somewhere else — the choppiness this exists to
 * remove.
 *
 * So the pressed tab is treated as current immediately, and `layoutId`
 * glides the pill and its marker there. The page then commits and mounts
 * a fresh copy of this nav with the same tab already active — the pill
 * is where the animation left it, so the remount is invisible.
 *
 * Reduced motion is handled by `MotionConfig reducedMotion="user"` in the
 * layout, which drops the transform and keeps the opacity. Nothing here
 * branches on the setting: doing that in a component breaks hydration,
 * because the server always renders the animated branch.
 */

export const TABS = [
  { id: "home", href: "/dashboard", label: "Home", Icon: HomeIcon },
  { id: "browse", href: "/browse", label: "Browse", Icon: BrowseIcon },
  { id: "requests", href: "/requests", label: "Requests", Icon: RequestsIcon },
  /* Its own tab. A request is a decision you make once; a conversation
     is somewhere you return to, and burying threads inside Requests made
     the second look like a footnote to the first. */
  { id: "messages", href: "/conversations", label: "Messages", Icon: ChatIcon },
  { id: "profile", href: "/onboarding", label: "Profile", Icon: ProfileIcon },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/* Short, and eased out rather than in-and-out: it should feel like the
   highlight is already on its way when you let go of the mouse. */
const GLIDE = { type: "spring", stiffness: 420, damping: 38, mass: 0.7 } as const;

function useOptimisticTab(active: TabId) {
  const pathname = usePathname();
  const [pressed, setPressed] = useState<TabId | null>(null);

  /* The real answer has landed; stop guessing. Also covers the back
     button and any redirect that sends them somewhere else entirely. */
  useEffect(() => setPressed(null), [pathname]);

  return [pressed ?? active, setPressed] as const;
}

export function SideNav({ active }: { active: TabId }) {
  const [current, press] = useOptimisticTab(active);

  return (
    <nav className="mt-9 flex flex-col gap-1">
      {TABS.map(({ id, href, label, Icon }) => {
        const on = id === current;
        return (
          <Link
            key={id}
            href={href}
            onClick={() => press(id)}
            aria-current={on ? "page" : undefined}
            className="relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[18px] font-semibold transition-colors"
          >
            {on ? (
              <>
                <motion.span
                  layoutId="sidenav-pill"
                  transition={GLIDE}
                  className="absolute inset-0 rounded-lg bg-white shadow-[0_2px_10px_-6px_rgba(20,18,18,0.3)]"
                />
                <motion.span
                  layoutId="sidenav-marker"
                  transition={GLIDE}
                  className="absolute inset-y-2 -right-4 w-1 rounded-full bg-peach"
                />
              </>
            ) : null}
            {/* Above the pill, which is absolutely positioned behind. */}
            <Icon className={`relative text-[20px] ${on ? "text-accent-deep" : ""}`} />
            <span className={`relative ${on ? "text-black" : "text-text"}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar({ active }: { active: TabId }) {
  const [current, press] = useOptimisticTab(active);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-soft-green bg-white lg:hidden">
      {/* Five labels at this app's 18px floor need 406 pixels. A 390pt
          iPhone has 390, an SE in a zoomed browser has 320, and the bar
          was quietly running "Profile" off the right edge on every one
          of them — invisible to a document-overflow check, because a
          fixed element that overflows does not lengthen the page.

          So the label belongs to the tab you are on, and the other four
          are their glyphs. You always know where you are, the names are
          still on the rail the moment there is room for it, and every
          tab keeps its name for a screen reader. The alternative was
          type below the floor, which is a promise this product made to
          people who need it. */}
      <div className="mx-auto flex max-w-[560px] items-stretch justify-between px-2">
        {TABS.map(({ id, href, label, Icon }) => {
          const on = id === current;
          return (
            <Link
              key={id}
              href={href}
              onClick={() => press(id)}
              aria-current={on ? "page" : undefined}
              aria-label={label}
              className={`relative flex min-w-[52px] flex-col items-center justify-center gap-1 px-2 py-2.5 text-[18px] font-semibold transition-colors ${
                on ? "text-peach-deep" : "text-text"
              }`}
            >
              {/* A rule under the tab rather than a pill behind it: at
                  this size a filled block leaves no room for the label
                  to breathe. */}
              {on ? (
                <motion.span
                  layoutId="tabbar-marker"
                  transition={GLIDE}
                  className="absolute inset-x-1.5 top-0 h-0.5 rounded-full bg-peach"
                />
              ) : null}
              <Icon className="text-[23px]" />
              {/* Hidden, not absent: the name is still the accessible
                  name of the link, and it comes back for everyone once
                  the bar has room to print all five. */}
              <span className={on ? "" : "sr-only min-[430px]:not-sr-only"}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
