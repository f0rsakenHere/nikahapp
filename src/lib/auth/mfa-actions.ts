"use server";

/* The second factor: the challenge at sign-in, and enrolling. */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { record } from "@/lib/audit";
import { isPrivileged } from "@/lib/domain/user";
import { clearPendingMfa } from "@/lib/repositories/sessions";
import { currentUser, pendingMfaSession } from "./current";
import { safeNext } from "./redirect";
import { generateSecret, otpauthUri, verifyTotp } from "./totp";

export type MfaState = { error?: string; secret?: string; uri?: string };

/** The session enrolment may run under.
 *
 *  Either a normal one, for someone turning 2FA on from their settings,
 *  or a half-authenticated one, for an account that *requires* a second
 *  factor and has not enrolled a secret yet. Staff accounts are created
 *  in exactly that state, so without this they would bounce between
 *  /login and /mfa forever: the challenge demands a code from an
 *  authenticator that was never set up, and enrolment lives behind a
 *  sign-in they cannot complete. Mandatory 2FA has to mean "enrol now",
 *  not "you are locked out". */
async function enrolmentSession() {
  const signedIn = await currentUser();
  if (signedIn) return { session: signedIn, pending: false };
  const pending = await pendingMfaSession();
  return pending ? { session: pending, pending: true } : null;
}

/** Answering the challenge. */
export async function submitMfaChallenge(_prev: MfaState, form: FormData): Promise<MfaState> {
  const session = await pendingMfaSession();
  if (!session) redirect("/login");

  const { user, tokenHash } = session;
  const secret = user.mfa.secret;
  if (!user.mfa.enabled) redirect("/login");
  /* Required, never enrolled: the page shows enrolment instead, so a
   * challenge submitted in this state is a stale form. */
  if (!secret) redirect("/mfa");

  if (!verifyTotp(secret, String(form.get("code") ?? ""), Date.now())) {
    await record({
      action: "account.mfaChallengeFailed",
      subject: { type: "user", id: user.id },
      actor: { userId: user.id, role: user.roles[0] },
    });
    /* One message, and no count. Telling someone how many attempts are
     * left is worth more to whoever is guessing than to whoever
     * mistyped. */
    return { error: "That code is not right. Check your authenticator app and try again." };
  }

  await clearPendingMfa(tokenHash);
  await record({
    action: "account.signedIn",
    subject: { type: "user", id: user.id },
    actor: { userId: user.id, role: user.roles[0] },
    meta: { secondFactor: "totp" },
  });

  redirect(safeNext(String(form.get("next") ?? "")));
}

/** Starts enrolment: mints a secret and hands back the URI to scan.
 *
 *  Nothing is saved yet. The secret is stored only once a code proves
 *  the app has it — otherwise a staff member who closed the tab midway
 *  would be locked out of an account that now demands a code from an
 *  authenticator they never finished setting up. */
export async function beginMfaEnrolment(): Promise<MfaState> {
  const found = await enrolmentSession();
  if (!found) redirect("/login");

  const { user } = found.session;
  if (user.mfa.enabled && user.mfa.secret) {
    return { error: "Two-factor is already on for this account." };
  }

  const secret = generateSecret();
  return { secret, uri: otpauthUri(secret, user.email) };
}

export async function confirmMfaEnrolment(_prev: MfaState, form: FormData): Promise<MfaState> {
  const found = await enrolmentSession();
  if (!found) redirect("/login");
  const { session, pending } = found;

  const secret = String(form.get("secret") ?? "");
  const code = String(form.get("code") ?? "");

  if (!secret) return { error: "Start again — the setup did not carry through." };
  if (!verifyTotp(secret, code, Date.now())) {
    return { secret, uri: otpauthUri(secret, session.user.email), error: "That code is not right." };
  }

  await (await getDb())
    .collection(COLLECTIONS.users)
    .updateOne(
      { _id: new ObjectId(session.user.id) },
      { $set: { "mfa.enabled": true, "mfa.secret": secret } }
    );

  await record({
    action: "account.mfaEnabled",
    subject: { type: "user", id: session.user.id },
    actor: { userId: session.user.id, role: session.user.roles[0] },
    /* The secret is deliberately not in the meta — `findSecrets` would
     * refuse the whole entry, which is the guard working. */
    meta: { privileged: isPrivileged(session.user.roles) },
  });

  /* Enrolling from the challenge screen completes the sign-in: the
   * second factor has just been proved, and asking for a code from the
   * app they set up ten seconds ago would be ceremony. */
  if (pending) {
    await clearPendingMfa(session.tokenHash);
    redirect(safeNext(String(form.get("next") ?? "")));
  }

  revalidatePath("/settings");
  return {};
}
