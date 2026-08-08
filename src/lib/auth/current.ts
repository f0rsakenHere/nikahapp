/* Reading the signed-in account on the server.
 *
 * The one entry point. Route handlers, server actions and Server
 * Components all call `currentUser()`; nothing reads the cookie itself.
 */
import { cookies } from "next/headers";
import { isPrivileged, type User } from "@/lib/domain/user";
import { findUserById } from "@/lib/repositories/users";
import {
  deleteSession,
  findSessionByTokenHash,
  touchSession,
} from "@/lib/repositories/sessions";
import {
  SESSION_COOKIE,
  hashSessionToken,
  sessionInvalidReason,
  slidIdleDeadline,
} from "./session";

export type Session = { user: User; tokenHash: string };

/** The signed-in account, or null.
 *
 *  Every call re-reads the user, which is the point of database sessions
 *  — a suspension, a role change or a password reset takes effect on the
 *  next request rather than whenever a token happens to expire. */
export async function currentUser(now: Date = new Date()): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await findSessionByTokenHash(tokenHash);
  if (!session) return null;

  const user = await findUserById(session.userId);
  if (!user) {
    await deleteSession(tokenHash);
    return null;
  }

  const invalid = sessionInvalidReason(session, user.tokenVersion, now);
  if (invalid) {
    /* Delete rather than leave it to the TTL index. A stale session that
     * lingers is a row in the member's own device list saying they are
     * signed in somewhere they are not. */
    await deleteSession(tokenHash);
    return null;
  }

  /* An account can be suspended or closed while signed in. */
  if (user.status !== "active") {
    await deleteSession(tokenHash);
    return null;
  }

  /* Password accepted, second factor not yet. Refused here rather than
   * guarded per-page, so a new screen is protected without anyone
   * remembering to think about it. */
  if (session.pendingMfa) return null;

  const slid = slidIdleDeadline(session, isPrivileged(user.roles), now);
  if (slid) await touchSession(tokenHash, slid, now);

  return { user, tokenHash };
}

/** The half-authenticated session, for the challenge screen alone. */
export async function pendingMfaSession(now: Date = new Date()): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await findSessionByTokenHash(tokenHash);
  if (!session || !session.pendingMfa) return null;

  const user = await findUserById(session.userId);
  if (!user || user.status !== "active") return null;
  if (sessionInvalidReason(session, user.tokenVersion, now)) {
    await deleteSession(tokenHash);
    return null;
  }

  return { user, tokenHash };
}

/** For pages that must have an account. Returns null rather than
 *  redirecting, so the caller decides where to send them — a member and
 *  a staff member do not go to the same sign-in screen. */
export async function requireUser(now: Date = new Date()): Promise<Session | null> {
  return currentUser(now);
}
