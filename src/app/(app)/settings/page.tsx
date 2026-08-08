import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { listSessionsForUser } from "@/lib/repositories/sessions";
import { mayRevealLinks } from "@/lib/notifications";
import { describeDevice } from "@/lib/domain/device";
import { AuthShell } from "../auth-shell";
import { ChangePassword, SendVerification, SessionRow, SignOutEverywhere } from "./forms";

export const metadata: Metadata = { title: "Your account — NikahCanada" };

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
  const sessions = await listSessionsForUser(user.id);

  return (
    <AuthShell
      title="Your account"
      blurb="Your email, your password, and where you are signed in."
      footer={
        <Link href="/onboarding" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
          Back to your profile
        </Link>
      }
    >
      <div className="flex flex-col gap-8">
        {/* ---------------------------------------------------- email -- */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
            Email
          </h2>
          <p className="text-[14px] text-black">{user.email}</p>

          {user.emailVerifiedAt ? (
            <p className="text-[12px] text-accent-deep">Confirmed {when(user.emailVerifiedAt)}</p>
          ) : (
            <>
              <p className="text-[12px] leading-[18px] text-peach-deep">
                Not confirmed yet. Your profile cannot be reviewed until it is.
              </p>
              {mayRevealLinks() ? (
                <p className="rounded-md border border-peach/40 bg-soft-peach/60 px-3.5 py-3 text-[12px] leading-[18px] text-text">
                  No email service is set up yet, so asking for a link shows it on this page
                  instead of sending it.
                </p>
              ) : null}
              <SendVerification />
            </>
          )}
        </section>

        {/* ------------------------------------------------- password -- */}
        <section className="flex flex-col gap-3 border-t border-soft-green pt-7">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
            Password
          </h2>
          <p className="text-[12px] leading-[18px] text-text">
            Changing it signs you out on every device, including this one.
          </p>
          <ChangePassword />
        </section>

        {/* ------------------------------------------------- sessions -- */}
        <section className="flex flex-col gap-3 border-t border-soft-green pt-7">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
            Where you are signed in
          </h2>

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

          {sessions.length > 1 ? <SignOutEverywhere /> : null}
        </section>
      </div>
    </AuthShell>
  );
}
