import Link from "next/link";
import type { Metadata } from "next";
import { verifyEmailToken } from "@/lib/auth/account-actions";
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
      blurb: "Thank you. Your address is confirmed and your profile can now be reviewed.",
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

  return (
    <AuthShell title={copy.title} blurb={copy.blurb}>
      <Link
        href={result === "invalid" ? "/settings" : "/onboarding"}
        className="grid h-12 place-items-center rounded-pill bg-peach text-[14px] font-semibold text-black"
      >
        {result === "invalid" ? "Go to your account" : "Continue"}
      </Link>
    </AuthShell>
  );
}
