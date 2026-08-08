"use server";

/* Sign up, sign in, sign out.
 *
 * Server actions rather than route handlers: the forms are progressively
 * enhanced and work without JavaScript, which matters for an audience
 * that includes walis on old phones.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isPrivileged, signInBlockedReason, validateSignup } from "@/lib/domain/user";
import {
  createMemberAccount,
  findUserByEmail,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/lib/repositories/users";
import { deleteSession, insertSession } from "@/lib/repositories/sessions";
import { currentUser } from "./current";
import { safeNext } from "./redirect";
import { equalisePasswordTiming, hashPassword, verifyPassword } from "./password";
import { SESSION_COOKIE, buildSession, sessionCookieOptions } from "./session";

export type FormState = {
  /* Keyed by field so the form can put each message next to its input.
   * `_form` carries anything that is not about one field. */
  errors?: Record<string, string>;
  values?: Record<string, string>;
};

const MESSAGES: Record<string, string> = {
  "email:invalid": "That does not look like an email address.",
  "email:taken": "An account already exists for that address.",
  "password:too-short": "Use at least 10 characters. A short sentence works well.",
  "password:too-long": "That is longer than we can accept.",
  "password:too-common": "That password is guessed too often. Please choose another.",
  "password:contains-email": "Please do not use your email address as your password.",
  "dateOfBirth:under-age": "You must be 18 or older to register.",
  "dateOfBirth:implausible": "Please check the date of birth.",
  "legalName:missing": "Please give your first name.",
  "gender:required": "Please choose whether you are registering as a brother or a sister.",
  "acceptedMarriageIntention:required": "Please confirm you are seeking marriage.",
  "acceptedTerms:required": "Please accept the privacy policy and terms.",
};

async function startSession(user: {
  id: string;
  tokenVersion: number;
  roles: readonly ("member" | "wali" | "staff" | "verifier" | "admin")[];
}) {
  const now = new Date();
  const { token, record } = buildSession(
    { userId: user.id, tokenVersion: user.tokenVersion, privileged: isPrivileged([...user.roles]) },
    now
  );
  await insertSession(record);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(record.absoluteExpiresAt));
}

/* --------------------------------------------------------------- signup - */

export async function register(_prev: FormState, form: FormData): Promise<FormState> {
  const raw = {
    gender: String(form.get("gender") ?? ""),
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    firstName: String(form.get("firstName") ?? ""),
    lastName: String(form.get("lastName") ?? ""),
    dateOfBirth: String(form.get("dateOfBirth") ?? ""),
  };

  /* Echoed back so a rejected form does not make them retype everything.
   * The password is deliberately not among them. */
  const values = {
    gender: raw.gender,
    email: raw.email,
    firstName: raw.firstName,
    lastName: raw.lastName,
    dateOfBirth: raw.dateOfBirth,
  };

  const dob = raw.dateOfBirth ? new Date(`${raw.dateOfBirth}T00:00:00Z`) : new Date("invalid");

  const validated = validateSignup(
    {
      gender: raw.gender as "brother" | "sister",
      email: raw.email,
      password: raw.password,
      legalName: { first: raw.firstName, last: raw.lastName || undefined },
      dateOfBirth: dob,
      locale: "en-CA",
      acceptedMarriageIntention: form.get("marriageIntention") === "on",
      acceptedTerms: form.get("terms") === "on",
    },
    new Date()
  );

  if (!validated.ok) {
    const errors: Record<string, string> = {};
    for (const e of validated.errors) {
      errors[e.field] = MESSAGES[`${e.field}:${e.code}`] ?? "Please check this.";
    }
    return { errors, values };
  }

  const created = await createMemberAccount(
    {
      gender: validated.value.gender,
      email: validated.value.email,
      passwordHash: await hashPassword(raw.password),
      legalName: validated.value.legalName,
      dateOfBirth: validated.value.dateOfBirth,
      locale: validated.value.locale,
    },
    new Date()
  );

  if (!created.ok) return { errors: { email: MESSAGES["email:taken"] }, values };

  await startSession(created.user);
  redirect("/onboarding");
}

/* ---------------------------------------------------------------- login - */

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  /* One message for every failure: wrong password, no such account,
   * suspended, locked. Anything more specific turns this form into a
   * membership oracle — and for a matrimonial service, confirming that
   * a particular person has an account is itself a disclosure. §7.1. */
  const generic = { errors: { _form: "Those details do not match an account." }, values: { email } };

  const user = await findUserByEmail(email);
  if (!user) {
    /* Spend the same time as a real verification, so response latency
     * does not answer the question the message refuses to. */
    await equalisePasswordTiming(password);
    return generic;
  }

  const now = new Date();
  if (signInBlockedReason(user, now)) {
    await equalisePasswordTiming(password);
    return generic;
  }

  const correct = await verifyPassword(user.passwordHash ?? "", password);
  if (!correct) {
    await recordFailedLogin(user.id, now);
    return generic;
  }

  await recordSuccessfulLogin(user.id, now);
  await startSession(user);
  redirect(safeNext(String(form.get("next") ?? "")));
}

/* --------------------------------------------------------------- logout - */

export async function logout(): Promise<void> {
  const session = await currentUser();
  if (session) await deleteSession(session.tokenHash);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
