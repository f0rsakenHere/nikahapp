"use server";

/* Sign up, sign in, sign out.
 *
 * Server actions rather than route handlers: the forms are progressively
 * enhanced and work without JavaScript, which matters for an audience
 * that includes walis on old phones.
 */
import { cookies, headers } from "next/headers";
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
import { record } from "@/lib/audit";
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

async function startSession(
  user: {
    id: string;
    tokenVersion: number;
    roles: readonly ("member" | "wali" | "staff" | "verifier" | "admin")[];
  },
  options: { pendingMfa?: boolean } = {}
) {
  const now = new Date();
  const h = await headers();
  const { token, record } = buildSession(
    {
      userId: user.id,
      tokenVersion: user.tokenVersion,
      privileged: isPrivileged([...user.roles]),
      /* So the device list in settings says something a person
       * recognises rather than "Unknown device" for every row. */
      userAgent: h.get("user-agent"),
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      pendingMfa: options.pendingMfa ?? false,
    },
    now
  );
  await insertSession(record);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(record.absoluteExpiresAt));
}

/* --------------------------------------------------------------- signup - */

/** The three boxes on the form, back into one date.
 *
 *  Assembled here rather than by a script on the page, so the form keeps
 *  working with JavaScript off. Anything that is not a plausible day,
 *  month and year comes back empty and fails validation as a date —
 *  including 31 February, which `Date` rejects for us because an ISO
 *  string is parsed strictly. */
function isoDate(day: string, month: string, year: string): string {
  const [d, m, y] = [day, month, year].map((s) => Number(s.trim()));
  if (![d, m, y].every(Number.isInteger)) return "";
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1000 || y > 9999) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export async function register(_prev: FormState, form: FormData): Promise<FormState> {
  const dob = {
    day: String(form.get("dobDay") ?? "").trim(),
    month: String(form.get("dobMonth") ?? "").trim(),
    year: String(form.get("dobYear") ?? "").trim(),
  };

  const raw = {
    gender: String(form.get("gender") ?? ""),
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    firstName: String(form.get("firstName") ?? ""),
    lastName: String(form.get("lastName") ?? ""),
    dateOfBirth: isoDate(dob.day, dob.month, dob.year),
  };

  /* Echoed back so a rejected form does not make them retype everything.
   * The password is deliberately not among them.
   *
   * The two agreements are echoed like any other answer. Ticking a box,
   * being told the date of birth is wrong, and finding the box you
   * ticked cleared is the form losing an answer that was given — and
   * without this the only thing restoring them is JavaScript, which
   * this form does not require. */
  const values = {
    gender: raw.gender,
    email: raw.email,
    firstName: raw.firstName,
    lastName: raw.lastName,
    /* The three boxes go back as three boxes: putting a normalised date
       into a field they typed in pieces is how you get a form that
       argues with the person filling it in. */
    dobDay: dob.day,
    dobMonth: dob.month,
    dobYear: dob.year,
    marriageIntention: form.get("marriageIntention") === "on" ? "on" : "",
    terms: form.get("terms") === "on" ? "on" : "",
  };

  const born = raw.dateOfBirth ? new Date(`${raw.dateOfBirth}T00:00:00Z`) : new Date("invalid");

  const validated = validateSignup(
    {
      gender: raw.gender as "brother" | "sister",
      email: raw.email,
      password: raw.password,
      legalName: { first: raw.firstName, last: raw.lastName || undefined },
      dateOfBirth: born,
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
    /* A blank date reaches validation looking identical to a wrong one,
       and "please check the date of birth" is a strange thing to read
       above three empty boxes. */
    if (errors.dateOfBirth && !(dob.day && dob.month && dob.year)) {
      errors.dateOfBirth = "Please give the day, month and year you were born.";
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

  await record({
    action: "account.registered",
    subject: { type: "user", id: created.user.id },
    actor: { userId: created.user.id, role: "member" },
    meta: { gender: validated.value.gender },
  });

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
    const count = await recordFailedLogin(user.id, now);
    await record({
      action: "account.signInFailed",
      subject: { type: "user", id: user.id },
      actor: { userId: user.id, role: user.roles[0] },
      meta: { consecutiveFailures: count },
    });
    return generic;
  }

  await recordSuccessfulLogin(user.id, now);

  /* Mandatory for staff and admin (§7.1), optional for everyone else.
   * The session is issued half-authenticated: the cookie exists, and
   * `currentUser()` refuses it until the second factor is in. */
  if (user.mfa.enabled) {
    await startSession(user, { pendingMfa: true });
    redirect(`/mfa?next=${encodeURIComponent(safeNext(String(form.get("next") ?? "")))}`);
  }

  await record({
    action: "account.signedIn",
    subject: { type: "user", id: user.id },
    actor: { userId: user.id, role: user.roles[0] },
  });

  await startSession(user);
  redirect(safeNext(String(form.get("next") ?? "")));
}

/* --------------------------------------------------------------- logout - */

export async function logout(): Promise<void> {
  const session = await currentUser();
  if (session) {
    await record({
      action: "account.signedOut",
      subject: { type: "user", id: session.user.id },
      actor: { userId: session.user.id, role: session.user.roles[0] },
    });
    await deleteSession(session.tokenHash);
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
