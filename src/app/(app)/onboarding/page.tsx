import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { logout } from "@/lib/auth/actions";
import { submitProfile } from "@/lib/profile/actions";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { hasConfirmedWali } from "@/lib/repositories/guardianships";
import { STEPS, completeness, stepsFor, submitBlockers } from "@/lib/domain/profile";
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
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;
  const session = await currentUser();
  if (!session) redirect("/login?next=/onboarding");

  const { user } = session;
  const profile = await findProfileByUserId(user.id);
  /* A wali has no profile of his own. He belongs in his portal, not on a
     screen telling him to finish something he never started. */
  if (!profile) redirect(user.roles.includes("wali") ? "/wali" : "/register");

  const visible = stepsFor(profile.gender);
  const ctx = { hasConfirmedWali: await hasConfirmedWali(user.id) };
  const blockers = submitBlockers(profile, ctx);
  /* Recomputed with the guardianship. The stored figure cannot see it,
     so a sister whose wali has confirmed would otherwise sit at 80%
     next to a button offering to submit. */
  const progress = completeness(profile, ctx);
  const blocked = new Set(blockers.map((b) => b.step));

  return (
    <AuthShell
      title={`Assalamu alaikum, ${user.legalName.first}`}
      blurb={
        profile.status !== "draft"
          ? "Your profile is with our team."
          : blockers.length
            ? "Your profile is not finished. Everything you have filled in is saved."
            : "Your profile is complete. Send it to us when you are ready."
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
      {profile.status !== "draft" ? (
        /* Once it is submitted the checklist is no longer the point.
           What she wants to know is what happens next, and the intake
           call is a published step — "we will speak with you by phone
           before any matching begins" — so it is said here rather than
           left as a silence. */
        <div className="mb-7 rounded-md border border-soft-green bg-mist px-4 py-4">
          <p className="text-[14px] font-semibold text-black">
            {submitted ? "Thank you — we have it." : "With our team"}
          </p>
          <p className="mt-2 text-[13px] leading-[20px] text-text">
            Someone will read your profile and telephone you before any matching begins. We check
            identity and speak to your reference or your wali first. You can still change your
            answers below.
          </p>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-2">
        {/* Counted from the same `blocked` set the list below ticks from.
            Deriving it separately gave "2 of 5 done" above a list with
            one tick in it, because the wali step is absent from the
            `incomplete` blockers without being finished. */}
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[1px] text-text/70">
          <span>
            {visible.filter((s) => !blocked.has(s.id)).length} of {visible.length} done
          </span>
          <span className="text-peach-deep">{progress.percent}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-soft-green">
          <div
            className="h-full rounded-full bg-peach transition-[width]"
            style={{ width: `${progress.percent}%` }}
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

      {profile.status === "draft" && blockers.length === 0 ? (
        <form action={submitProfile} className="mt-7">
          <button
            type="submit"
            className="h-12 w-full rounded-pill bg-peach text-[14px] font-semibold text-black"
          >
            Send my profile for review
          </button>
        </form>
      ) : null}

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
