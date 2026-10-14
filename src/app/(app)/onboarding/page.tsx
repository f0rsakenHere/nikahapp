import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { logout } from "@/lib/auth/actions";
import { submitProfile } from "@/lib/profile/actions";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { hasConfirmedWali } from "@/lib/repositories/guardianships";
import { completeness, stepsFor, submitBlockers } from "@/lib/domain/profile";
import { Check } from "@/components/app/kit";
import { ConfirmEmail } from "@/components/app/confirm-email";
import { AppIllustration } from "@/components/app/illustration";
import { AppFrame } from "../frame";

export const metadata: Metadata = { title: "Your profile | NikahCanada" };

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

  const isDone = (id: (typeof visible)[number]["id"]) => {
    /* The wali step cannot be answered from the blockers, and this broke
       the moment he stopped being one. `submitBlockers` never mentions
       him now — she can send her profile in while he is still deciding —
       so "not blocked" came out as "done" and the checklist ticked a man
       who had not replied to his email.
       
       It is answered by the thing that is actually true of it instead:
       `required` asks the context whether he has confirmed. */
    if (id === "guardian") {
      const step = visible.find((s) => s.id === id)!;
      return step.required(profile, ctx);
    }
    return !blocked.has(id);
  };

  /* The steps still wanting an answer from her, and the first of them.
     The wali step is not one of them: it is somebody else's reply, not a
     form she has left half-filled. */
  const unfinished = visible.filter((s) => s.id !== "guardian" && !isDone(s.id));
  const nextStep = unfinished[0] ?? null;
  const waitingOnWaliStep = visible.some((s) => s.id === "guardian" && !isDone(s.id));

  /* Everything standing between her and sending it in, in one list and
     in the order she would do them. The email belongs in it: it is not a
     step on the checklist, but it holds the profile back exactly as one
     does, and leaving it out was half the confusion. */
  const outstanding = [
    ...(user.emailVerifiedAt ? [] : ["Confirm your email address"]),
    ...unfinished.map((s) => s.title),
  ];

  const blurb =
    profile.status !== "draft"
      ? "Your profile is with our team."
      : blockers.length
        ? "Your profile is not finished. Everything you have filled in is saved."
        : "Your profile is complete. Send it to us when you are ready.";

  /* The app's own frame, not the signed-out one. This is a member screen
     — they are signed in, and framing it like the register page left it
     an island with no way back to the pool, in a 440px column with a
     monitor either side of it. */
  return (
    <AppFrame
      active="profile"
      width="wide"
      title="Your profile"
      aside={
        <span className="text-[18px] text-text">
          {visible.filter((s) => isDone(s.id)).length} of {visible.length} steps done
        </span>
      }
    >
      <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-soft-green bg-linear-to-r from-mist/60 to-white px-5 py-4 shadow-app sm:px-6">
        <p className="max-w-[60ch] text-[18px] leading-[26px] text-text">{blurb}</p>
        <AppIllustration kind="profile" size="small" />
      </div>
      {profile.status !== "draft" ? (
        /* Once it is submitted the checklist is no longer the point;
           what they want to know is what happens next. It used to say we
           would telephone them first. We do not telephone anybody, so it
           says what is actually true of the wait instead. */
        <div className="mb-7 rounded-md border border-soft-green bg-mist px-4 py-4">
          <p className="text-[18px] font-semibold text-black">
            {submitted ? "Thank you, we have it." : "With our team"}
          </p>
          <p className="mt-2 text-[18px] leading-[26px] text-text">
            {profile.gender === "sister"
              ? "Your profile goes into the pool once your wali has confirmed. You can still change your answers below."
              : "Your profile is in. You can still change your answers below."}
          </p>
        </div>
      ) : null}

      {/* What is actually left, named, with the way into it.
          A member wrote in at 75%: "I am not sure what else the
          app/website requires. It says my profile is not finished. I do
          not see a submit button." Everything he needed was on the
          screen — one unticked circle in a four-row list, and a submit
          button that does not exist until the list is clear — and none
          of it was legible as an instruction. */}
      {profile.status === "draft" && outstanding.length > 0 ? (
        <div className="mb-7 rounded-md border border-peach bg-soft-peach/40 px-4 py-4">
          <p className="text-[18px] font-semibold text-black">
            {outstanding.length === 1 ? "One thing left" : `${outstanding.length} things left`}
          </p>
          <ol className="mt-2 flex flex-col gap-1.5">
            {outstanding.map((item, i) => (
              <li key={item} className="flex gap-2.5 text-[18px] leading-[26px] text-text">
                <span className="font-semibold text-peach-deep">{i + 1}.</span>
                {item}
              </li>
            ))}
          </ol>
          {nextStep ? (
            <Link
              href={`/onboarding/${nextStep.id}`}
              className="mt-3.5 inline-flex h-12 items-center rounded-pill bg-peach px-5 text-[18px] font-semibold leading-none text-black"
            >
              Finish {nextStep.title.toLowerCase()}
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* Her side is done and nobody is asking her for anything. Said
          plainly, because "not finished" next to four ticks reads as a
          fault of hers. */}
      {profile.status === "draft" && !nextStep && waitingOnWaliStep ? (
        <div className="mb-7 rounded-md border border-soft-green bg-mist px-4 py-4">
          <p className="text-[18px] font-semibold text-black">Waiting on your wali</p>
          <p className="mt-1 text-[18px] leading-[26px] text-text">
            Everything on your side is answered. Your profile goes in once he confirms by email —
            you can send him a reminder from the wali step below.
          </p>
        </div>
      ) : null}

      {/* First thing on the first screen after registering, because that
          is when the email is arriving. */}
      {user.emailVerifiedAt ? null : <ConfirmEmail email={user.email} />}
      <div className="mb-6 flex flex-col gap-2">
        {/* Counted from the same `blocked` set the list below ticks from.
            Deriving it separately gave "2 of 5 done" above a list with
            one tick in it, because the wali step is absent from the
            `incomplete` blockers without being finished. */}
        <div className="flex items-center justify-between text-[18px] font-semibold uppercase tracking-[1px] text-text/70">
          <span>
            {visible.filter((s) => isDone(s.id)).length} of {visible.length} done
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

      <ol
        /* Two abreast where there is room. Six one-line rows down the
           middle of a monitor is a phone screenshot with the sides cut
           off. */
        className="grid grid-cols-1 gap-2 lg:grid-cols-2"
      >
        {visible.map((step) => {
          const done = isDone(step.id);
          /* The one step nobody can finish alone, and only a sister has
             it. Reported as waiting on somebody rather than as her
             failure to fill something in. */
          const waitingOnWali = step.id === "guardian" && !done;

          return (
            /* `h-full` on both: a grid row is as tall as its tallest
               card, and without it the shorter one — the wali step,
               which has a line fewer — sat in a box of its own size
               with a gap under it. */
            <li key={step.id} className="h-full">
              <Link
                href={`/onboarding/${step.id}`}
                /* The one that still wants something is the one that
                   looks different. Four rows in the same grey, one of
                   them carrying a dashed circle instead of a tick, is a
                   difference nobody reads as "this one is for you". */
                className={`flex h-full items-center gap-3.5 rounded-xl border px-4 py-4 shadow-app transition-[border-color,box-shadow,background-color] hover:shadow-soft ${
                  done
                    ? "border-soft-green hover:border-accent-deep"
                    : waitingOnWali
                      ? "border-soft-green bg-mist hover:border-accent-deep"
                      : "border-peach bg-soft-peach/30 hover:border-peach-deep"
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[18px] font-semibold ${
                    done
                      ? "bg-peach text-black"
                      : waitingOnWali
                        ? "border border-dashed border-soft-green text-text/50"
                        : "border-2 border-peach-deep text-peach-deep"
                  }`}
                >
                  {/* Numbered by what this member is shown, not by the
                      position in `STEPS` — that list holds both slot-4
                      definitions, so a brother's reference came out as 5
                      under a 3, with no 4 anywhere on the screen. */}
                  {done ? <Check className="h-3.5 w-3.5" /> : visible.indexOf(step) + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[18px] font-semibold text-black">{step.title}</span>
                  <span
                    className={`text-[18px] leading-[26px] ${
                      done || waitingOnWali ? "text-text/70" : "font-semibold text-peach-deep"
                    }`}
                  >
                    {waitingOnWali ? "Waiting on your wali" : done ? "Done" : "Not finished yet"}
                  </span>
                  {done || waitingOnWali ? null : (
                    <span className="text-[18px] leading-[26px] text-text/70">{step.blurb}</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {/* Both buttons keep a form's width rather than stretching to the
          full page: a submit button as wide as a monitor reads as a
          banner, not something to press. */}
      {profile.status === "draft" && blockers.length === 0 ? (
        user.emailVerifiedAt ? (
          <form action={submitProfile} className="mt-8 max-w-[420px]">
            <button
              type="submit"
              className="h-12 w-full rounded-pill bg-peach text-[18px] font-semibold text-black"
            >
              Send my profile for review
            </button>
          </form>
        ) : (
          /* Finished, but unreachable. The panel at the top of this page
             is where the link is re-sent, so this says what is missing
             rather than repeating the button. */
          <p className="mt-8 max-w-[420px] rounded-md border border-peach bg-soft-peach/40 px-4 py-4 text-[18px] leading-[26px] text-text">
            Your profile is finished. Confirm your email address above and you can send it in.
          </p>
        )
      ) : profile.status === "draft" ? (
        /* A button that is simply absent is the thing the member could
           not explain to himself. This one is present, refuses, and says
           what it is waiting for. */
        <div className="mt-8 max-w-[420px]">
          <button
            type="button"
            disabled
            className="h-12 w-full cursor-not-allowed rounded-pill bg-soft-green/60 text-[18px] font-semibold text-text/60"
          >
            Send my profile for review
          </button>
          <p className="mt-2 text-[18px] leading-[26px] text-text/70">
            {nextStep
              ? `Finish ${nextStep.title.toLowerCase()} first.`
              : user.emailVerifiedAt
                ? "Waiting on your wali to confirm."
                : "Confirm your email address first."}
          </p>
        </div>
      ) : null}

      <div className="mt-8 flex max-w-[420px] flex-col gap-3 border-t border-soft-green pt-6">
        <Link
          href="/how-it-works"
          className="text-[18px] font-semibold text-peach-deep underline-offset-2 hover:underline"
        >
          How it works
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="h-12 w-full rounded-pill border-2 border-accent-deep text-[18px] font-semibold text-accent-deep"
          >
            Sign out
          </button>
        </form>
      </div>
    </AppFrame>
  );
}
