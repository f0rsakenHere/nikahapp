/* Session tokens: how they are made, stored and expired.
 *
 * ── Why not Auth.js, for now ───────────────────────────────────────────
 * docs/APP-PLAN.md §4.1 names Auth.js v5, and §7.1 requires "session list
 * with remote revoke" and absolute plus idle timeouts. Those two cannot
 * both be had yet: Auth.js's Credentials provider forces the JWT session
 * strategy, and a JWT cannot be revoked — you can only wait for it to
 * expire. Database sessions in Auth.js need the Email provider, which
 * needs an email account the client has not supplied.
 *
 * So sessions are database-backed here. The security-sensitive parts are
 * the ordinary ones and are tested: argon2id for passwords (password.ts),
 * 256 bits of CSPRNG for the token, the token stored only as a SHA-256
 * digest, and an httpOnly/secure/sameSite cookie.
 *
 * When the email provider arrives, Auth.js can be layered on for magic
 * links; this collection is shaped like its adapter's so the two can
 * coexist. Revisit then — not before.
 * ──────────────────────────────────────────────────────────────────────
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

if (typeof window !== "undefined") {
  throw new Error("src/lib/auth/session.ts was imported into client code");
}

/* Re-exported for convenience. The definition lives in cookie.ts so
 * `middleware.ts` can read the name without importing `node:crypto`,
 * which the edge runtime does not have. */
export { SESSION_COOKIE } from "./cookie";

/* Idle: signed out after this long with no request. Absolute: signed out
 * this long after signing in, however active. Both are required by §7.1
 * — the absolute cap is what bounds the damage from a stolen cookie on a
 * device that stays in use. */
export const IDLE_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const ABSOLUTE_TIMEOUT_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/* Staff read private correspondence, so their sessions are short enough
 * that an unattended laptop stops being an open door the same day. */
export const STAFF_IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
export const STAFF_ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type SessionRecord = {
  tokenHash: string;
  userId: string;
  /** Copied from the user at sign-in. Bumping `users.tokenVersion`
   *  invalidates every session issued before it, which is how a password
   *  change signs out the other devices. */
  tokenVersion: number;
  createdAt: Date;
  lastSeenAt: Date;
  /** Idle deadline; slid forward as the session is used. */
  expiresAt: Date;
  /** Hard deadline; never moves. */
  absoluteExpiresAt: Date;
  userAgent: string | null;
  ip: string | null;
};

/** A fresh token and the digest to store.
 *
 *  The plaintext goes to the browser and is never written down. A
 *  database leak therefore yields digests, which cannot be replayed —
 *  the same reason passwords are not stored either. */
export function newSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashSessionToken(token) };
}

/** SHA-256, not argon2. A 256-bit random token has no guessable
 *  structure, so the slow hash that protects a human-chosen password
 *  buys nothing here and would cost a full argon2 computation on every
 *  single request. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of two digests. */
export function sameToken(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function sessionTimeouts(privileged: boolean): { idleMs: number; absoluteMs: number } {
  return privileged
    ? { idleMs: STAFF_IDLE_TIMEOUT_MS, absoluteMs: STAFF_ABSOLUTE_TIMEOUT_MS }
    : { idleMs: IDLE_TIMEOUT_MS, absoluteMs: ABSOLUTE_TIMEOUT_MS };
}

export function buildSession(
  input: { userId: string; tokenVersion: number; privileged: boolean; userAgent?: string | null; ip?: string | null },
  now: Date
): { token: string; record: SessionRecord } {
  const { token, tokenHash } = newSessionToken();
  const { idleMs, absoluteMs } = sessionTimeouts(input.privileged);
  return {
    token,
    record: {
      tokenHash,
      userId: input.userId,
      tokenVersion: input.tokenVersion,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + idleMs),
      absoluteExpiresAt: new Date(now.getTime() + absoluteMs),
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
    },
  };
}

export type SessionInvalidReason = "idle-expired" | "absolute-expired" | "token-version-stale";

/** Why this session should no longer be honoured, or null if it stands.
 *
 *  `currentTokenVersion` comes from the user record, so a session is
 *  checked against the account on every request rather than trusted
 *  until it expires. That is the whole point of database sessions. */
export function sessionInvalidReason(
  session: Pick<SessionRecord, "expiresAt" | "absoluteExpiresAt" | "tokenVersion">,
  currentTokenVersion: number,
  now: Date
): SessionInvalidReason | null {
  if (session.absoluteExpiresAt <= now) return "absolute-expired";
  if (session.expiresAt <= now) return "idle-expired";
  if (session.tokenVersion !== currentTokenVersion) return "token-version-stale";
  return null;
}

/** The new idle deadline, or null when it is not worth a database write.
 *
 *  Sliding the window on literally every request turns a read-only page
 *  view into a write. Moving it only once it has drifted by more than an
 *  hour keeps the behaviour and drops almost all of the writes. */
export function slidIdleDeadline(
  session: Pick<SessionRecord, "expiresAt" | "absoluteExpiresAt">,
  privileged: boolean,
  now: Date
): Date | null {
  const { idleMs } = sessionTimeouts(privileged);
  const proposed = new Date(Math.min(now.getTime() + idleMs, session.absoluteExpiresAt.getTime()));
  const drift = proposed.getTime() - session.expiresAt.getTime();
  return drift > 60 * 60 * 1000 ? proposed : null;
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    /* `lax`, not `strict`: the wali arrives by clicking a link in an
     * email, and `strict` would drop the cookie on that navigation and
     * bounce him to a login screen he does not have a password for. */
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}
