import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { pendingMfaSession } from "@/lib/auth/current";
import { AuthShell } from "../auth-shell";
import { MfaChallengeForm } from "./form";
import { MfaEnrolAtSignIn } from "./enrol";

export const metadata: Metadata = {
  title: "Two-factor — NikahCanada",
  robots: { index: false, follow: false },
};

/* The half-authenticated screen. The cookie exists but `currentUser()`
 * refuses it, so nothing else in the product is reachable from here —
 * which is why this page reads the session through its own function
 * rather than being handed one. */
export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await pendingMfaSession();
  if (!session) redirect("/login");

  /* Required but never enrolled: a staff account on its first sign-in.
     Enrolment, not a challenge, or the account is unreachable forever. */
  if (!session.user.mfa.secret) {
    return (
      <AuthShell
        title="Set up two-factor"
        blurb="This account reads private correspondence, so a password on its own is not enough. Add NikahCanada to an authenticator app to finish signing in."
      >
        <MfaEnrolAtSignIn next={next} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Enter your code"
      blurb="Open your authenticator app and type the six digits it shows for NikahCanada."
    >
      <MfaChallengeForm next={next} />
    </AuthShell>
  );
}
