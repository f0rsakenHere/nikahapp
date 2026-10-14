import Link from "next/link";
import type { ReactNode } from "react";
import { currentUser } from "@/lib/auth/current";
import { countUnread } from "@/lib/repositories/notifications";
import { touchActivity } from "@/lib/repositories/profiles";
import { Logo } from "@/components/brand/Logo";
import { AccountIcon, BellIcon, SignOutIcon } from "@/components/app/icons";
import { logout } from "@/lib/auth/actions";
import { SideNav, TabBar, type TabId } from "./nav";
import { PageTransition } from "./transition";

/* The member app's chrome.
 *
 * Distinct from `AuthShell`, which frames the screens somebody sees
 * before they have an account, and from `AdminShell`, which staff live
 * in. Three frames rather than one because the worst confusion in a
 * product like this is not knowing whose view you are looking at.
 *
 * ── The shape ─────────────────────────────────────────────────────────
 * A three-pane split view — the sidebar/list/detail arrangement every
 * mail client uses — reduced to the two panes this product actually has
 * on most screens: navigation, and the thing you are looking at. It
 * fills the window rather than floating in it: the pool is a grid, and
 * width spent on margins is width not spent on profiles.
 *
 * `list` is the third pane. Pages that are a list *and* a detail —
 * conversations, requests — pass one, and it sits between the sidebar
 * and the content at desktop widths.
 *
 * Under `lg` none of that survives: the sidebar becomes a bottom tab
 * bar under the thumb, and the list pane stacks above the content.
 * Same tree either way — no duplicated nav to drift apart, and no
 * user-agent sniffing, which gets a tablet wrong every time.
 * ──────────────────────────────────────────────────────────────────────
 */

/* The bell, wherever the chrome has room for it.
 *
 * The count is passed in rather than read here, so this same chrome can
 * be rendered by a route's `loading` state — which cannot await
 * anything — while the page behind it is still being built. */
function Bell({ compact, unread }: { compact?: boolean; unread: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
      className={
        compact
          ? /* A 22px glyph is a 22px target. The padding is the tap
               area — it costs nothing on screen and is the difference
               between hitting the bell and hitting the logo. */
            "relative -m-2 grid h-11 w-11 place-items-center text-[22px] text-accent-deep"
          : "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[18px] font-semibold text-text transition-colors hover:bg-white/70 hover:text-black"
      }
    >
      <BellIcon className={compact ? "" : "text-[20px]"} />
      {compact ? null : "Notifications"}
      {unread ? (
        /* A dot on the phone, a count in the rail. A numeral small
           enough to sit on a 22px bell would be well under the 18px
           floor this app holds to, and "there is something" is all the
           badge needs to say — the number is on the page it opens. */
        compact ? (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-peach ring-2 ring-white" />
        ) : (
          <span className="ml-auto grid h-7 min-w-7 place-items-center rounded-full bg-peach px-1.5 text-[18px] font-semibold text-black">
            {unread}
          </span>
        )
      ) : null}
    </Link>
  );
}

/** The chrome, with nothing fetched.
 *
 *  Separate from `AppFrame` so that a route's `loading.tsx` can render
 *  the same sidebar, header and tab bar around a skeleton. Switching
 *  tabs used to sit on the old screen until the next one had been built
 *  on the server — no spinner, no skeleton, nothing to say the tap had
 *  registered — because the chrome was inside the page and a loading
 *  state would have blanked the whole window. */
export function AppShell({
  active,
  title,
  /** Sits opposite the title — a filter row, a count, an action. */
  aside,
  /** The middle pane, for screens that are a list beside a detail. */
  list,
  /** Which of the two is *the screen* on a phone.
   *
   *  A list beside a detail is a desktop arrangement. Stacking both on a
   *  phone put the whole conversation list above the thread you had just
   *  opened — you tapped a message and got the list again, with the
   *  first message a screen and a half down — and, on the index, printed
   *  the list and then "Pick a conversation to read it" underneath it,
   *  which is an instruction for a pane a phone does not have. So on a
   *  phone one of them is the screen and the other is not rendered. */
  phone = "content",
  /** `wide` gives the content pane its full width; the default keeps a
   *  reading column for pages that are mostly prose or a form. */
  width = "reading",
  unread = 0,
  children,
}: {
  active: TabId;
  title: string;
  aside?: ReactNode;
  list?: ReactNode;
  phone?: "list" | "content";
  width?: "reading" | "wide";
  /** Unread notifications, for the badge. Zero while a page loads. */
  unread?: number;
  children: ReactNode;
}) {
  /* Full bleed. This was a floating panel capped at 1520px, which on a
     wide monitor spends the extra width on empty margins either side —
     and the pool is a grid, so the room is worth having. */
  return (
    <div className="app-type min-h-dvh bg-white font-manrope text-black">
      {/* Stacked on a phone, side by side from lg. Left as a row, the
          list pane (w-full) and the content pane (flex-1) sat in the
          same row and together exceeded the viewport — the page scrolled
          sideways on every conversation screen. */}
      <div className="flex min-h-dvh w-full flex-col lg:flex-row">
        {/* ---- pane one: where you can go --------------------------- */}
        <aside className="hidden w-[264px] shrink-0 flex-col border-r border-soft-green bg-mist/40 px-4 py-6 lg:flex">
          <Link href="/dashboard" aria-label="NikahCanada" className="-my-2.5 px-3 py-2.5">
            {/* The rail is 264px less 32 of its own padding and 24 of the
                link's, so 208 is all there is. The wordmark at h-7 is
                220 and would have run into the border — and the
                responsive sweep would never have said so, because the
                rail only exists from lg up and that sweep stops at 768.
                Measured here instead. */}
            <Logo className="h-5" priority />
          </Link>

          <SideNav active={active} />

          <div className="mt-auto flex flex-col gap-1">
            <Bell unread={unread} />
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[18px] font-semibold text-accent-deep transition-colors hover:bg-white/70"
            >
              <AccountIcon className="text-[20px]" />
              Account
            </Link>
            {/* Signing out was two screens deep, inside Account, under
                everything else on it. A member asked where it was, which
                is the only evidence this kind of thing needs. */}
            <form action={logout}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[18px] font-semibold text-text transition-colors hover:bg-white/70 hover:text-black"
              >
                <SignOutIcon className="text-[20px]" />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        {/* ---- the phone's header: no room for a rail --------------- */}
        <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-soft-green bg-white/95 px-5 py-3 backdrop-blur lg:hidden">
          <Link href="/dashboard" aria-label="NikahCanada" className="-my-3 flex items-center py-3">
            <Logo className="h-4" priority />
          </Link>
          <div className="flex items-center gap-5">
            <Bell compact unread={unread} />
            <Link
              href="/settings"
              aria-label="Your account"
              className="-m-2 grid h-11 w-11 place-items-center text-[22px] text-accent-deep"
            >
              <AccountIcon />
            </Link>
          </div>
        </header>

        {/* ---- pane two: the list, when there is one ---------------- */}
        {list ? (
          <div
            className={`w-full shrink-0 border-soft-green pb-28 pt-16 lg:w-[340px] lg:border-r lg:pb-0 lg:pt-0 xl:w-[380px] ${
              phone === "content" ? "hidden lg:block" : ""
            }`}
          >
            {list}
          </div>
        ) : null}

        {/* ---- pane three: what you came to look at ----------------- */}
        <main
          className={`min-w-0 flex-1 px-5 pb-28 pt-20 lg:px-8 lg:pb-10 lg:pt-8 ${
            phone === "list" ? "hidden lg:block" : ""
          }`}
        >
          <div className={width === "wide" ? "" : "max-w-[860px]"}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <h1 className="font-manrope text-[26px] font-bold leading-tight text-black lg:text-[32px]">
                {title}
              </h1>
              {aside}
            </div>
            <PageTransition>
              <div className="mt-6 lg:mt-8">{children}</div>
            </PageTransition>
          </div>
        </main>
      </div>

      <TabBar active={active} />

    </div>
  );
}

/** The chrome, with the member's own numbers in it.
 *
 *  Being here is recorded here, in the one component every member screen
 *  renders, rather than in each page — a presence signal that some
 *  screens report and others do not would say "last seen Tuesday" about
 *  somebody who has been reading their messages all week. Rate limited to
 *  one write an hour in the query itself, and it never throws. */
export async function AppFrame(
  props: Omit<Parameters<typeof AppShell>[0], "unread">
) {
  const here = await currentUser();
  if (here) await touchActivity(here.user.id, new Date());
  const unread = here ? await countUnread(here.user.id) : 0;

  return <AppShell {...props} unread={unread} />;
}

export type { TabId };
