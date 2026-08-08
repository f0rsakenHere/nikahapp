import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { RegisterForm } from "./form";

export const metadata: Metadata = { title: "Create your account — NikahCanada" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      /* The three claims that are still true under browsing. "Never
         public" was narrowed to "never outside the service" when the
         model changed — see src/content/home.ts. */
      blurb="Registration is free. A photograph is not required, and your profile is never seen outside the service."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
