import Link from "next/link";
import { AppIllustration } from "./illustration";
import { ChevronRight } from "./icons";

/** A small marriage motif and a useful route into the service guide. */
export function SidebarStory() {
  return (
    <div className="sidebar-story mt-6 shrink-0 flex-col items-center rounded-2xl border border-soft-green bg-linear-to-b from-white/90 to-mist/50 px-3 pt-3 text-center shadow-app">
      <AppIllustration kind="sidebar-garden" size="sidebar" />
      <p className="mt-1 text-[18px] font-semibold text-black">Your next chapter</p>
      <Link
        href="/how-it-works"
        className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg px-2 text-[18px] font-semibold text-accent-deep underline-offset-4 hover:underline"
      >
        How it works
        <ChevronRight className="text-[18px]" />
      </Link>
    </div>
  );
}
