import type { ReactNode } from "react";
import { AppIllustration, type AppIllustrationKind } from "./illustration";

/** Keep empty screens as considered as screens containing member data. */
export function AppEmptyState({
  kind,
  children,
  compact = false,
  className = "",
}: {
  kind: AppIllustrationKind;
  children: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl border border-soft-green bg-linear-to-b from-mist/60 to-white px-5 py-8 text-center shadow-app ${className}`}
    >
      <AppIllustration kind={kind} compact={compact} />
      <p className="max-w-[52ch] text-[18px] leading-[26px] text-text">{children}</p>
    </div>
  );
}
