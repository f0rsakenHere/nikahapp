import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { safeNext } from "@/lib/auth/redirect";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Sign in — NikahCanada" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; changed?: string; signedout?: string; wali?: string }>;
}) {
  const { next, reset, changed, signedout, wali } = await searchParams;

  /* Already signed in: go where they were headed, or home. A session
     that is only half authenticated — the cookie is set, the second
     factor is not in — is not a session here, so `currentUser` returns
     nothing and the form still renders. That is what keeps the MFA
     challenge escapable in the right direction. */
  if (await currentUser()) redirect(safeNext(next));

  /* Said here rather than on the page they came from, because all three
     end in a redirect to this screen and a message that survives the
     redirect is the only one they will see. */
  const notice = wali
    ? "Thank you — you are confirmed as her wali. Sign in to see your account."
    : reset
    ? "Your password has been reset. Sign in with the new one."
    : changed
      ? "Your password has been changed. Sign in again."
      : signedout
        ? "You have been signed out on every device."
        : null;

  return (
    <AuthShell
      title="Sign in"
      blurb="Members and walis sign in here."
      footer={
        <>
          No account yet?{" "}
          <Link href="/register" className="font-semibold text-peach-deep underline-offset-2 hover:underline">
            Register
          </Link>
          {" · "}
          <Link
            href="/forgot-password"
            className="font-semibold text-peach-deep underline-offset-2 hover:underline"
          >
            Forgot your password?
          </Link>
        </>
      }
    >
      {notice ? (
        <p
          role="status"
          className="mb-5 rounded-md border border-soft-green bg-mist px-3.5 py-3 text-[18px] leading-[26px] text-black"
        >
          {notice}
        </p>
      ) : null}
      <LoginForm next={next} />
    </AuthShell>
  );
}
