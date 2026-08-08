/* The account, and what it takes to create one.
 *
 * docs/APP-PLAN.md §5.1 for the document, §7.1 for the rules. Pure — no
 * database, no clock, no hashing. `now` is always passed in.
 *
 * Note what is *not* here: gender. It lives on the profile (§5.2), set at
 * signup and immutable, because it is a fact about the person seeking
 * marriage rather than about the login. One account can hold several
 * roles — a brother who is also his sister's wali is a common case — so
 * putting gender on the account would make that arrangement ambiguous.
 * Signing up therefore creates a `users` document and a `profiles` draft
 * together, in one transaction.
 */
import { z } from "zod";

/* --------------------------------------------------------------- roles -- */

export const ROLES = ["member", "wali", "staff", "verifier", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Roles that can read other people's private correspondence, and for
 *  which §7.1 makes TOTP non-negotiable. */
export const PRIVILEGED_ROLES: ReadonlySet<Role> = new Set(["staff", "verifier", "admin"]);

export function isPrivileged(roles: readonly Role[]): boolean {
  return roles.some((r) => PRIVILEGED_ROLES.has(r));
}

/** §7.1: mandatory 2FA for staff and admin, optional for everyone else. */
export function mfaRequired(roles: readonly Role[]): boolean {
  return isPrivileged(roles);
}

/* -------------------------------------------------------------- schema -- */

export const UserSchema = z.object({
  id: z.string().min(1),

  /* Lowercased on the way in. Two accounts differing only in case would
   * be two people as far as the unique index is concerned, and one
   * person as far as the human typing it is concerned. */
  email: z.email().refine((e) => e === e.toLowerCase(), {
    message: "email must be stored lowercased",
  }),
  emailVerifiedAt: z.date().nullable(),

  passwordHash: z.string().min(1).nullable(),

  roles: z.array(z.enum(ROLES)).min(1),
  status: z.enum(["active", "suspended", "closed"]),
  locale: z.enum(["en-CA", "fr-CA"]),

  /* 🔎 Released to a counterpart only at step 06. Held here rather than
   * on the profile because it identifies the account holder. */
  legalName: z.object({ first: z.string().min(1), last: z.string().optional() }),

  phone: z
    .object({ e164: z.string().min(1), verifiedAt: z.date().nullable() })
    .nullable(),

  /* 🔒 Exact date. Matching uses `profiles.basics.birthYear` in the clear;
   * this is the encrypted original, seen by staff during verification. */
  dateOfBirth: z.date(),

  mfa: z.object({ enabled: z.boolean(), secret: z.string().nullable() }),

  lastLoginAt: z.date().nullable(),
  failedLoginCount: z.number().int().min(0),
  lockedUntil: z.date().nullable(),

  /* Bumped to invalidate every issued session for this account — the
   * remote-revoke mechanism. See src/lib/auth/README notes. */
  tokenVersion: z.number().int().min(0),

  closedAt: z.date().nullable(),
  closureReason: z.string().nullable(),
})
  .refine((u) => !mfaRequired(u.roles) || u.mfa.enabled, {
    message: "staff, verifier and admin accounts must have 2FA enabled",
    path: ["mfa", "enabled"],
  })
  .refine((u) => u.status !== "closed" || u.closedAt !== null, {
    message: "a closed account must record when it closed",
    path: ["closedAt"],
  });

export type User = z.infer<typeof UserSchema>;

/* -------------------------------------------------------------- signup -- */

export const MIN_AGE = 18;
export const MIN_PASSWORD_LENGTH = 10;

/* Bounded because the hash cost is paid by the server. Argon2id has no
 * practical input limit, so without this a megabyte password is a free
 * denial of service. */
export const MAX_PASSWORD_LENGTH = 200;

/* Not a password strength meter. Length carries the weight (NIST SP
 * 800-63B), and composition rules mostly produce Passw0rd!. This is only
 * the handful that survive a length rule and are still guessed first. */
const BANNED_PASSWORDS = new Set([
  "password123",
  "passw0rd123",
  "1234567890",
  "12345678901",
  "123456789012",
  "qwertyuiop",
  "letmeinplease",
  "iloveyou123",
  "welcome1234",
  "nikahcanada",
  "bismillah123",
  "alhamdulillah",
]);

export const SignupInputSchema = z.object({
  gender: z.enum(["brother", "sister"]),
  email: z.string().min(1),
  password: z.string(),
  legalName: z.object({ first: z.string().min(1), last: z.string().optional() }),
  dateOfBirth: z.date(),
  locale: z.enum(["en-CA", "fr-CA"]).default("en-CA"),
  /* Both are shown as explicit checkboxes on the sign-up screen, in
   * plain words rather than buried in terms. Storing the acceptance is
   * the point — it is what makes the declaration meaningful later.
   *
   * Typed `boolean` rather than `literal(true)` because an unticked box
   * is exactly what this has to be able to receive and reject; a type
   * that cannot represent the failure cannot validate it. */
  acceptedMarriageIntention: z.boolean(),
  acceptedTerms: z.boolean(),
})
  .refine((i) => i.acceptedMarriageIntention, {
    message: "the marriage-only declaration must be accepted",
    path: ["acceptedMarriageIntention"],
  })
  .refine((i) => i.acceptedTerms, {
    message: "the terms must be accepted",
    path: ["acceptedTerms"],
  });

export type SignupInput = z.input<typeof SignupInputSchema>;

export type SignupError =
  | { field: "email"; code: "invalid" }
  | { field: "password"; code: "too-short" | "too-long" | "too-common" | "contains-email" }
  | { field: "dateOfBirth"; code: "under-age" | "implausible" }
  | { field: "legalName"; code: "missing" }
  | { field: "acceptedMarriageIntention"; code: "required" }
  | { field: "acceptedTerms"; code: "required" }
  | { field: "gender"; code: "required" };

export type SignupResult =
  | {
      ok: true;
      value: {
        gender: "brother" | "sister";
        email: string;
        legalName: { first: string; last?: string };
        dateOfBirth: Date;
        locale: "en-CA" | "fr-CA";
        age: number;
        roles: Role[];
      };
    }
  | { ok: false; errors: SignupError[] };

/** Whole years between two dates, not counting a birthday still to come. */
export function ageOn(birth: Date, on: Date): number {
  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const months = on.getUTCMonth() - birth.getUTCMonth();
  if (months < 0 || (months === 0 && on.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

/** Validates a sign-up, collecting *every* problem rather than stopping
 *  at the first — a form that reveals its objections one at a time is a
 *  worse form. */
export function validateSignup(input: SignupInput, now: Date): SignupResult {
  const errors: SignupError[] = [];

  const email = String(input.email ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) errors.push({ field: "email", code: "invalid" });

  const password = String(input.password ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push({ field: "password", code: "too-short" });
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push({ field: "password", code: "too-long" });
  } else if (BANNED_PASSWORDS.has(password.toLowerCase())) {
    errors.push({ field: "password", code: "too-common" });
  } else {
    /* A password containing the account name is the account name. */
    const localPart = email.split("@")[0] ?? "";
    if (localPart.length >= 4 && password.toLowerCase().includes(localPart)) {
      errors.push({ field: "password", code: "contains-email" });
    }
  }

  const first = input.legalName?.first?.trim();
  if (!first) errors.push({ field: "legalName", code: "missing" });

  const dob = input.dateOfBirth;
  let age = -1;
  if (!(dob instanceof Date) || Number.isNaN(dob.getTime())) {
    errors.push({ field: "dateOfBirth", code: "implausible" });
  } else {
    age = ageOn(dob, now);
    if (age < MIN_AGE) errors.push({ field: "dateOfBirth", code: "under-age" });
    else if (age > 120) errors.push({ field: "dateOfBirth", code: "implausible" });
  }

  if (input.gender !== "brother" && input.gender !== "sister") {
    errors.push({ field: "gender", code: "required" });
  }
  if (input.acceptedMarriageIntention !== true) {
    errors.push({ field: "acceptedMarriageIntention", code: "required" });
  }
  if (input.acceptedTerms !== true) errors.push({ field: "acceptedTerms", code: "required" });

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      gender: input.gender as "brother" | "sister",
      email,
      legalName: { first: first!, last: input.legalName?.last?.trim() || undefined },
      dateOfBirth: dob,
      locale: (input.locale ?? "en-CA") as "en-CA" | "fr-CA",
      age,
      /* Everyone starts as a member. A wali is granted his role by
       * accepting an invitation, never by signing up and claiming it. */
      roles: ["member"],
    },
  };
}

/* ------------------------------------------------------------- lockout -- */

/* §7.1: progressive lockout. Short at first so a person who mistypes
 * twice is not punished, steep afterwards so guessing is not viable.
 * Thresholds are cumulative failures since the last success. */
const LOCKOUT_LADDER: readonly { after: number; minutes: number }[] = [
  { after: 5, minutes: 1 },
  { after: 7, minutes: 5 },
  { after: 10, minutes: 30 },
  { after: 15, minutes: 60 * 4 },
];

/** When the account should be locked until, given this many consecutive
 *  failures. Null while still below the first threshold. */
export function lockoutUntil(failedLoginCount: number, now: Date): Date | null {
  let minutes = 0;
  for (const step of LOCKOUT_LADDER) if (failedLoginCount >= step.after) minutes = step.minutes;
  return minutes ? new Date(now.getTime() + minutes * 60_000) : null;
}

export function isLocked(user: Pick<User, "lockedUntil">, now: Date): boolean {
  return user.lockedUntil !== null && user.lockedUntil > now;
}

/** Whether an account is permitted to sign in at all, ignoring the
 *  password. Returns a reason so the caller can decide what to disclose
 *  — which is a different question, and usually the answer is "nothing"
 *  (§7.1: a reset must not reveal whether an account exists). */
export function signInBlockedReason(
  user: Pick<User, "status" | "lockedUntil" | "passwordHash">,
  now: Date
): "suspended" | "closed" | "locked" | "no-password-set" | null {
  if (user.status === "closed") return "closed";
  if (user.status === "suspended") return "suspended";
  if (isLocked(user, now)) return "locked";
  if (!user.passwordHash) return "no-password-set";
  return null;
}
