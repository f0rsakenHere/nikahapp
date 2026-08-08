import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { ResetPasswordForm } from "./form";

export const metadata: Metadata = {
  title: "Choose a new password — NikahCanada",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  /* The token is not checked here, only carried. Verifying on render
   * would consume it — every link preview, prefetch and antivirus
   * scanner that opens the URL would burn the reset before the person
   * ever saw the form. It is consumed on submit instead. */
  if (!token) {
    return (
      <AuthShell
        title="That link is incomplete"
        blurb="The address is missing its token. Open the link from your email again, or ask for a new one."
        footer={
          <Link href="/forgot-password" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
            Ask for a new link
          </Link>
        }
      >
        <span />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      blurb="Once you save it, you will be signed out everywhere and can sign in again."
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
