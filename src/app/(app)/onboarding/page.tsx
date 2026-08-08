import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { logout } from "@/lib/auth/actions";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Onboarding — NikahCanada" };

/* Where sign-up and sign-in land. A placeholder with one real job: it
 * proves the session round-trips, and it is the seam the five-step
 * profile builder (§5.2, and the ProfileDeen mock-up) grows from. */
export default async function OnboardingPage() {
  const session = await currentUser();
  if (!session) redirect("/login");

  const { user } = session;

  return (
    <AuthShell
      title={`Assalamu alaikum, ${user.legalName.first}`}
      blurb="Your account exists. The profile builder is the next thing to be built — five steps, saved as you go."
    >
      <dl className="flex flex-col gap-3 text-[13px]">
        {[
          ["Signed in as", user.email],
          ["Roles", user.roles.join(", ")],
          ["Email verified", user.emailVerifiedAt ? "yes" : "not yet"],
        ].map(([k, val]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-soft-green pb-2">
            <dt className="text-text/70">{k}</dt>
            <dd className="text-right font-semibold text-black">{val}</dd>
          </div>
        ))}
      </dl>

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
