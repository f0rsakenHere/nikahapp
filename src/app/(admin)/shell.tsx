import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/lib/auth/actions";
import type { User } from "@/lib/domain/user";

/* The staff console's frame.
 *
 * Deliberately plain, and deliberately not the member app's frame. Staff
 * spend hours here and should never be a click away from thinking they
 * are looking at a member's own screen — §7.8 will add an impersonation
 * banner on top of that, and the two need to be visually distinct before
 * that arrives, not after.
 */
export function AdminShell({
  title,
  subtitle,
  user,
  children,
  back,
}: {
  title: string;
  subtitle?: string;
  user: Pick<User, "legalName" | "roles">;
  children: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="min-h-dvh bg-white font-jost text-black">
      <header className="border-b border-soft-green bg-mist">
        <div className="mx-auto flex max-w-[1000px] items-center justify-between px-5 py-3">
          <Link href="/admin" className="font-playfair text-[18px] font-bold text-black">
            NikahCanada <span className="font-jost text-[12px] font-semibold text-accent-deep">staff</span>
          </Link>
          <div className="flex items-center gap-4 text-[12px] text-text">
            <span>
              {user.legalName.first} · {user.roles.join(", ")}
            </span>
            <form action={logout}>
              <button type="submit" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1000px] px-5 py-8">
        {back ? (
          <Link
            href={back.href}
            className="mb-4 inline-block text-[13px] text-text underline-offset-2 hover:underline"
          >
            ← {back.label}
          </Link>
        ) : null}

        <h1 className="font-playfair text-[28px] font-bold leading-tight text-black">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13px] text-text">{subtitle}</p> : null}

        <div className="mt-7">{children}</div>
      </main>
    </div>
  );
}
