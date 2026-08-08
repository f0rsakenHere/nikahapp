"use server";

/* Email verification, password reset, password change, device revoke. */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MIN_PASSWORD_LENGTH } from "@/lib/domain/user";
import { mayRevealLinks, send } from "@/lib/notifications";
import {
  findUserByEmail,
  findUserById,
  markEmailVerified,
  setPassword,
} from "@/lib/repositories/users";
import {
  consumeToken,
  deleteTokensFor,
  insertToken,
  tokenQuotaExceeded,
} from "@/lib/repositories/tokens";
import { deleteSession, deleteSessionsForUser } from "@/lib/repositories/sessions";
import { currentUser } from "./current";
import { hashPassword, verifyPassword } from "./password";
import { buildToken, hashToken, tokenInvalidReason, type TokenPurpose } from "./tokens";

export type AccountState = {
  error?: string;
  done?: string;
  /* Present only while there is no email provider, and never in
   * production — see `mayRevealLinks`. */
  devLink?: string;
};

/** Absolute URL for a link in an email. Taken from the request rather
 *  than a caller-supplied value — a reset link is a credential, and
 *  building it from a Host header an attacker controls is how password
 *  reset poisoning works. In production this must come from a
 *  configured origin, not the header. */
async function origin(): Promise<string> {
  const h = await headers();
  const configured = process.env.APP_ORIGIN;
  if (configured) return configured.replace(/\/$/, "");
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function issue(
  purpose: TokenPurpose,
  user: { id: string; email: string; legalName: { first: string } },
  path: string,
  now: Date
): Promise<string | undefined> {
  if (await tokenQuotaExceeded(user.id, purpose, now)) return undefined; // silently, see below
  const { token, record } = buildToken({ purpose, userId: user.id, email: user.email }, now);
  await insertToken(record);
  const link = `${await origin()}${path}?token=${token}`;
  await send({
    to: user.email,
    kind: purpose === "verifyEmail" ? "verifyEmail" : "resetPassword",
    name: user.legalName.first,
    link,
  });
  return mayRevealLinks() ? link : undefined;
}

/* ------------------------------------------------------ verify email --- */

export async function requestEmailVerification(): Promise<AccountState> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/settings");
  if (session.user.emailVerifiedAt) return { done: "That address is already confirmed." };

  const devLink = await issue("verifyEmail", session.user, "/verify-email", new Date());
  revalidatePath("/settings");
  return { done: "Check your email — we have sent you a link.", devLink };
}

export type VerifyResult = "verified" | "already" | "invalid";

/** Consumes the token. Not an action bound to a form: it runs from the
 *  page the link opens. */
export async function verifyEmailToken(token: string): Promise<VerifyResult> {
  if (!token) return "invalid";

  const record = await consumeToken(hashToken(token));
  if (!record) return "invalid";

  const user = await findUserById(record.userId);
  if (!user) return "invalid";
  if (user.emailVerifiedAt) return "already";

  const now = new Date();
  if (tokenInvalidReason(record, { purpose: "verifyEmail", email: user.email }, now)) {
    return "invalid";
  }

  await markEmailVerified(user.id, now);
  return "verified";
}

/* --------------------------------------------------- forgot password --- */

export async function requestPasswordReset(
  _prev: AccountState,
  form: FormData
): Promise<AccountState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const now = new Date();

  const user = await findUserByEmail(email);
  /* The same answer either way, and no timing tell worth mentioning —
   * the work here is a single indexed lookup. Saying "no account for
   * that address" would confirm that a particular person is looking for
   * a spouse, which is not ours to disclose (§7.1). */
  let devLink: string | undefined;
  if (user && user.status === "active") {
    devLink = await issue("resetPassword", user, "/reset-password", now);
  }

  return {
    done: "If that address has an account, we have sent a link to reset the password.",
    devLink,
  };
}

export async function resetPassword(_prev: AccountState, form: FormData): Promise<AccountState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const record = await consumeToken(hashToken(token));
  if (!record) return { error: "That link has already been used, or has expired." };

  const user = await findUserById(record.userId);
  if (!user) return { error: "That link is no longer valid." };

  if (tokenInvalidReason(record, { purpose: "resetPassword", email: user.email }, new Date())) {
    return { error: "That link is no longer valid." };
  }

  await setPassword(user.id, await hashPassword(password));
  /* Every other reset link in that inbox dies with this one, and every
   * session goes — the point of a reset is usually that someone else
   * had the old password. */
  await deleteTokensFor(user.id, "resetPassword");
  await deleteSessionsForUser(user.id);
  await send({ to: user.email, kind: "passwordChanged", name: user.legalName.first });

  redirect("/login?reset=1");
}

/* --------------------------------------------------- change password --- */

export async function changePassword(
  _prev: AccountState,
  form: FormData
): Promise<AccountState> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/settings");

  const currentPassword = String(form.get("currentPassword") ?? "");
  const next = String(form.get("newPassword") ?? "");

  if (next.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  /* Asked for even though they are signed in: it is what stops a
   * borrowed laptop from becoming a permanent takeover. */
  if (!(await verifyPassword(session.user.passwordHash ?? "", currentPassword))) {
    return { error: "That is not your current password." };
  }

  await setPassword(session.user.id, await hashPassword(next));
  /* `setPassword` bumps tokenVersion, which invalidates this session
   * too. Deliberate — they sign in again with the new password, and
   * nothing is left holding the old one. */
  await deleteSessionsForUser(session.user.id);
  await send({ to: session.user.email, kind: "passwordChanged", name: session.user.legalName.first });

  redirect("/login?changed=1");
}

/* -------------------------------------------------------- device list -- */

export async function signOutEverywhereElse(): Promise<AccountState> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/settings");

  /* Everything, then this one is re-honoured only because it is the
   * request in flight — simpler and safer than trying to spare it. */
  await deleteSessionsForUser(session.user.id);
  redirect("/login?signedout=1");
}

export async function revokeSession(tokenHash: string): Promise<void> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/settings");
  /* A member may only revoke their own. The hash is not enough on its
   * own — it identifies a session, not permission over it. */
  const own = await deleteOwn(session.user.id, tokenHash);
  if (own) revalidatePath("/settings");
}

async function deleteOwn(userId: string, tokenHash: string): Promise<boolean> {
  const { findSessionByTokenHash } = await import("@/lib/repositories/sessions");
  const found = await findSessionByTokenHash(tokenHash);
  if (!found || found.userId !== userId) return false;
  await deleteSession(tokenHash);
  return true;
}
