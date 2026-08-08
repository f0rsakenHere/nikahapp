import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { logout } from "@/lib/auth/actions";
import { listWardsForWali } from "@/lib/repositories/guardianships";
import { findUserById } from "@/lib/repositories/users";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Your wards — NikahCanada" };

/* The wali's home.
 *
 * Sparse on purpose: there are no introductions to approve and no
 * conversations to read yet, and a portal full of empty sections would
 * imply the parts that do not exist. It says what is true — that he is
 * confirmed, that nothing needs him yet, and that we will write when it
 * does. */
export default async function WaliPortalPage() {
  const session = await currentUser();
  if (!session) redirect("/login?next=/wali");

  const { user } = session;
  const wards = await listWardsForWali(user.id);

  /* A member who is not a wali for anyone should not be here. Sending
     him to his own profile is friendlier than a 403 he cannot act on. */
  if (wards.length === 0 && !user.roles.includes("wali")) redirect("/onboarding");

  const names = await Promise.all(
    wards.map(async (w) => {
      const member = await findUserById(w.memberUserId);
      return {
        id: w.id,
        first: member?.legalName.first ?? "Your ward",
        confirmedAt: w.confirmedAt,
        verification: w.verification.state,
      };
    })
  );

  return (
    <AuthShell
      title={`Assalamu alaikum, ${user.legalName.first}`}
      blurb={
        wards.length
          ? "You are the confirmed wali for the people below. We will write to you when something needs your attention."
          : "You are not currently acting as a wali for anyone."
      }
      footer={
        <Link href="/settings" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
          Your account
        </Link>
      }
    >
      <ul className="flex flex-col gap-2">
        {names.map((w) => (
          <li
            key={w.id}
            className="flex flex-col gap-1 rounded-md border border-soft-green px-3.5 py-3"
          >
            <span className="text-[14px] font-semibold text-black">{w.first}</span>
            <span className="text-[11px] text-text/70">
              Confirmed{" "}
              {w.confirmedAt
                ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(
                    w.confirmedAt
                  )
                : ""}
              {w.verification === "verified" ? " · identity verified" : " · awaiting our checks"}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-7 rounded-md border border-soft-green bg-mist px-4 py-4 text-[13px] leading-[20px] text-text">
        Nothing needs you yet. When she receives an introduction you will see it here at the
        same moment she does, and no conversation opens until you approve it.
      </div>

      <form action={logout} className="mt-7">
        <button
          type="submit"
          className="h-12 w-full rounded-pill border-2 border-accent-deep text-[14px] font-semibold text-accent-deep"
        >
          Sign out
        </button>
      </form>
    </AuthShell>
  );
}
