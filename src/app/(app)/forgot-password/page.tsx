import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { ForgotPasswordForm } from "./form";

export const metadata: Metadata = {
  title: "Reset your password — NikahCanada",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      blurb="Give us the address you registered with and we will send a link."
      footer={
        <Link href="/login" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
