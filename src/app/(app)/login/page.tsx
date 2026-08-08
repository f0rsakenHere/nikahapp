import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Sign in — NikahCanada" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

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
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
