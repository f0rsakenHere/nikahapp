import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { listSessionsForUser } from "@/lib/repositories/sessions";
import { mayRevealLinks } from "@/lib/notifications";
import { describeDevice } from "@/lib/domain/device";
import { mfaRequired } from "@/lib/domain/user";
import { AuthShell } from "../auth-shell";
import { ChangePassword, SendVerification, SessionRow, SignOutEverywhere } from "./forms";
import { MfaSection } from "./mfa";
import { ExportData, PauseOrResume, WithdrawOrDelete } from "./lifecycle";
import { findProfileByUserId } from "@/lib/repositories/profiles";

export const metadata: Metadata = { title: "Your account — NikahCanada" };

/* `break-inside-avoid` and a margin rather than a grid gap: the layout
   below is CSS columns, and a card that splits across the fold is worse
   than any gap it would close. */
const PANEL =
  "mb-5 flex break-inside-avoid flex-col gap-3 rounded-lg border border-soft-green bg-white p-5 sm:p-6";
const PANEL_TITLE = "text-[18px] font-semibold uppercase tracking-[0.6px] text-text/70";

function when(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export default async function SettingsPage() {
  const session = await currentUser();
  if (!session) redirect("/login?next=/settings");

  const { user, tokenHash } = session;
  const { sessions, total: signedInOn } = await listSessionsForUser(user.id, { pin: tokenHash });
  const profile = await findProfileByUserId(user.id);

  return (
    <AuthShell
      width="page"
      title="Your account"
      blurb="Your email, your password, and where you are signed in."
      back={{ href: "/dashboard", label: "Back to the app" }}
      footer={
        <Link href="/onboarding" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
          Back to your profile
        </Link>
      }
    >
      {/* Panels rather than one long column of rules. Stacked on a
          phone, two abreast where there is room — this page is seven
          unrelated settings, not a sequence, so nothing is lost by
          reading them side by side.
          Columns, not a grid. A grid aligns rows, so a short panel next
          to a tall one leaves a rectangle of empty page beside it —
          "Email" beside "Password" left exactly that. Columns pack each
          card under the previous one and the holes disappear. */}
      <div className="lg:columns-2 lg:gap-5">
        {/* ---------------------------------------------------- email -- */}
        <section className={PANEL}>
          <h2 className={PANEL_TITLE}>Email</h2>
          <p className="text-[18px] text-black">{user.email}</p>

          {user.emailVerifiedAt ? (
            <p className="text-[18px] text-accent-deep">Confirmed {when(user.emailVerifiedAt)}</p>
          ) : (
            <>
              <p className="text-[18px] leading-[26px] text-peach-deep">
                Not confirmed yet. Your profile cannot be reviewed until it is.
              </p>
              {mayRevealLinks() ? (
                <p className="rounded-md border border-peach/40 bg-soft-peach/60 px-3.5 py-3 text-[18px] leading-[26px] text-text">
                  No email service is set up yet, so asking for a link shows it on this page
                  instead of sending it.
                </p>
              ) : null}
              <SendVerification />
            </>
          )}
        </section>

        {/* ------------------------------------------------- password -- */}
        <section className={PANEL}>
          <h2 className={PANEL_TITLE}>Password</h2>
          <p className="text-[18px] leading-[26px] text-text">
            Changing it signs you out on every device, including this one.
          </p>
          <ChangePassword />
        </section>

        {/* ------------------------------------------------ two-factor -- */}
        <section className={PANEL}>
          <h2 className={PANEL_TITLE}>Two-factor authentication</h2>
          <MfaSection enabled={user.mfa.enabled} required={mfaRequired(user.roles)} />
        </section>

        {/* ------------------------------------------------- sessions -- */}
        <section className={PANEL}>
          <h2 className={PANEL_TITLE}>Where you are signed in</h2>

          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <SessionRow
                key={s.tokenHash}
                tokenHash={s.tokenHash}
                isCurrent={s.tokenHash === tokenHash}
                lastSeen={when(s.lastSeenAt)}
                /* Not the raw user-agent: every one of them starts
                   "Mozilla/5.0", so trimming to the first bracket
                   labelled every row identically and uselessly. */
                device={describeDevice(s.userAgent)}
              />
            ))}
          </ul>

          {/* What is not on the list. Said plainly, with the number, so
              that "sign out everywhere" is understood to reach further
              than the rows above it. */}
          {signedInOn > sessions.length ? (
            <p className="text-[18px] leading-[26px] text-text/70">
              {signedInOn - sessions.length} older sign-in
              {signedInOn - sessions.length === 1 ? " is" : "s are"} not shown. Signing out
              everywhere ends all {signedInOn}.
            </p>
          ) : null}

          {signedInOn > 1 ? <SignOutEverywhere /> : null}
        </section>

        {/* --------------------------------------------- your record -- */}
        {profile ? (
          <section className={PANEL}>
            <h2 className={PANEL_TITLE}>Your profile</h2>
            <PauseOrResume status={profile.status} />
          </section>
        ) : null}

        <section className={PANEL}>
          <h2 className={PANEL_TITLE}>Your data</h2>
          <ExportData />
        </section>

        <section className={PANEL}>
          <h2 className={PANEL_TITLE}>Leaving</h2>
          <WithdrawOrDelete status={profile?.status ?? "draft"} />
        </section>
      </div>
    </AuthShell>
  );
}
