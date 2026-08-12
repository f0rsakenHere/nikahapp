import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { isStaffActor } from "@/lib/domain/authorisation";
import { AuthShell } from "../auth-shell";
import { RegisterForm } from "./form";

export const metadata: Metadata = { title: "Create your account — NikahCanada" };

export default async function RegisterPage() {
  /* Signing up again is not what somebody with an account wants, and
     the form would only tell them the address is taken.
   *
   * The condition is "has somewhere else to be" rather than plain
   * "signed in", because the dashboard sends an account with no profile
   * *here* — that is the only place a profile can be made. Redirecting
   * every session away would put those two pages in a loop and lock the
   * account out of the one screen that could repair it. */
  const session = await currentUser();
  if (session) {
    const { roles, id } = session.user;
    const settled =
      isStaffActor(roles) || roles.includes("wali") || (await findProfileByUserId(id));
    if (settled) redirect("/dashboard");
  }

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
