import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/bridely/primitives/Wordmark";

/* The member app's chrome.
 *
 * Distinct from `AuthShell`, which frames the screens somebody sees
 * before they have an account, and from `AdminShell`, which staff live
 * in. Three frames rather than one because the worst confusion in a
 * product like this is not knowing whose view you are looking at.
 */
const TABS = [
  { id: "browse", href: "/browse", label: "Browse" },
  { id: "requests", href: "/requests", label: "Requests" },
  { id: "profile", href: "/onboarding", label: "Profile" },
] as const;

export function AppFrame({
  active,
  title,
  children,
}: {
  active: (typeof TABS)[number]["id"];
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-white font-jost text-black">
      <header className="border-b border-soft-green bg-mist">
        <div className="mx-auto flex max-w-[560px] items-center justify-between px-5 py-3">
          <Link href="/browse" aria-label="NikahCanada">
            {/* not leading-none: Playfair's line box is taller than 1em
                and the wordmark loses its descender to the clip */}
            <Wordmark className="text-[18px] leading-[1.3]" />
          </Link>
          <Link href="/settings" className="text-[12px] font-semibold text-accent-deep">
            Account
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[560px] px-5 pb-28 pt-6">
        <h1 className="font-playfair text-[26px] font-bold leading-tight text-black">{title}</h1>
        <div className="mt-5">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-soft-green bg-white">
        <div className="mx-auto flex max-w-[560px]">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={tab.id === active ? "page" : undefined}
              className={`flex-1 py-3.5 text-center text-[12px] font-semibold ${
                tab.id === active ? "text-peach-deep" : "text-text"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
