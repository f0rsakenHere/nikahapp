import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Sign in — NikahCanada" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; changed?: string; signedout?: string }>;
}) {
  const { next, reset, changed, signedout } = await searchParams;

  /* Said here rather than on the page they came from, because all three
     end in a redirect to this screen and a message that survives the
     redirect is the only one they will see. */
  const notice = reset
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
          className="mb-5 rounded-md border border-soft-green bg-mist px-3.5 py-3 text-[13px] leading-[19px] text-black"
        >
          {notice}
        </p>
      ) : null}
      <LoginForm next={next} />
    </AuthShell>
  );
}
