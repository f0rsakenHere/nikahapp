import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { logout } from "@/lib/auth/actions";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { STEPS, stepsFor, submitBlockers } from "@/lib/domain/profile";
import { Check } from "@/components/app/kit";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Your profile — NikahCanada" };

/* Progress, and the way back into whichever step is unfinished.
 *
 * A list rather than a wizard that marches you forward: people fill
 * these in over several sittings and want to see what is left, and the
 * one step a sister cannot finish alone — her wali — needs to be visible
 * as *waiting on someone else* rather than as her failure to complete
 * it. */
export default async function OnboardingPage() {
  const session = await currentUser();
  if (!session) redirect("/login?next=/onboarding");

  const { user } = session;
  const profile = await findProfileByUserId(user.id);
  if (!profile) redirect("/register");

  const visible = stepsFor(profile.gender);
  /* Nothing invites a wali yet, so this is honestly false for everyone
     until that flow exists. */
  const blockers = submitBlockers(profile, { hasConfirmedWali: false });
  const blocked = new Set(blockers.map((b) => b.step));

  return (
    <AuthShell
      title={`Assalamu alaikum, ${user.legalName.first}`}
      blurb={
        blockers.length
          ? "Your profile is not finished. Everything you have filled in is saved."
          : "Your profile is complete and ready to be sent for review."
      }
      footer={
        <>
          <Link href="/settings" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
            Your account
          </Link>{" "}
          ·{" "}
          <Link href="/how-it-works" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
            How it works
          </Link>
        </>
      }
    >
      <div className="mb-6 flex flex-col gap-2">
        {/* Counted from the same `blocked` set the list below ticks from.
            Deriving it separately gave "2 of 5 done" above a list with
            one tick in it, because the wali step is absent from the
            `incomplete` blockers without being finished. */}
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[1px] text-text/70">
          <span>
            {visible.filter((s) => !blocked.has(s.id)).length} of {visible.length} done
          </span>
          <span className="text-peach-deep">{profile.completeness.percent}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-soft-green">
          <div
            className="h-full rounded-full bg-peach transition-[width]"
            style={{ width: `${profile.completeness.percent}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {visible.map((step) => {
          const done = !blocked.has(step.id);
          const waitingOnWali = step.id === "guardian" && !done;

          return (
            <li key={step.id}>
              <Link
                href={`/onboarding/${step.id}`}
                className="flex items-center gap-3.5 rounded-md border border-soft-green px-3.5 py-3 transition-colors hover:border-accent-deep"
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                    done
                      ? "bg-peach text-black"
                      : "border border-dashed border-soft-green text-text/50"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : STEPS.indexOf(step) + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[14px] font-semibold text-black">{step.title}</span>
                  <span className="text-[11px] leading-[15px] text-text/70">
                    {waitingOnWali ? "Waiting on your wali" : done ? "Done" : step.blurb}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

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
