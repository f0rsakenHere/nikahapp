import Link from "next/link";
import type { Metadata } from "next";
import { verifyEmailToken } from "@/lib/auth/account-actions";
import { currentUser } from "@/lib/auth/current";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = {
  title: "Confirm your email — NikahCanada",
  robots: { index: false, follow: false },
};

/* Public: the link is usually opened in whatever browser the person's
 * email client hands it to, which is often not the one they signed up
 * in. Requiring a session here would make the link fail exactly when it
 * is most likely to be used. */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await verifyEmailToken(token ?? "");

  const copy = {
    verified: {
      title: "Email confirmed",
      blurb: "Thank you. That address is yours, and we can reach you on it.",
    },
    already: {
      title: "Already confirmed",
      blurb: "This address was confirmed earlier. There is nothing more to do.",
    },
    invalid: {
      title: "That link did not work",
      blurb:
        "It may have expired, or been used already — each link works once. Sign in and ask for a new one.",
    },
  }[result];

  /* Where "Continue" goes, which is not one place.
   *
   * It used to be the profile checklist every time. Opened from the mail
   * app in a browser with no session that is a sign-in wall, and for
   * somebody who has already finished and sent their profile in it is
   * the form they are done with — both read as being sent backwards by
   * a button that says Continue.
   *
   * So it is answered from what is actually true of the reader: finish
   * the profile, go to the dashboard, or sign in first. */
  const session = result === "invalid" ? null : await currentUser();
  const profile = session ? await findProfileByUserId(session.user.id) : null;

  const next = !session
    ? { href: "/login?next=/dashboard", label: "Sign in" }
    : profile?.status === "draft"
      ? { href: "/onboarding", label: "Finish your profile" }
      : profile
        ? { href: "/dashboard", label: "Go to your account" }
        : /* Signed in with no profile of their own: a wali, who has a
             portal rather than a profile. */
          { href: session.user.roles.includes("wali") ? "/wali" : "/onboarding", label: "Continue" };

  return (
    <AuthShell title={copy.title} blurb={copy.blurb}>
      <Link
        href={result === "invalid" ? "/settings" : next.href}
        className="grid h-12 place-items-center rounded-pill bg-peach text-[18px] font-semibold text-black"
      >
        {result === "invalid" ? "Go to your account" : next.label}
      </Link>
    </AuthShell>
  );
}
