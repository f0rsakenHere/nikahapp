/* Single-use, expiring tokens: email verification and password reset.
 *
 * The same shape as a session token and for the same reasons — 256 bits
 * of CSPRNG, stored only as a SHA-256 digest — but with three extra
 * properties that matter here:
 *
 *   single use   consumed atomically, so a link forwarded or scraped
 *                from an inbox cannot be replayed after the fact
 *   short lived  minutes to hours, not weeks
 *   bound        to the account *and* to the address it was sent to, so
 *                changing your email invalidates a reset already in
 *                flight to the old one
 *
 * This is also the shape the wali invitation will take (§7.1 calls it
 * "the most security-sensitive link in the system" — it grants read
 * access to a woman's private correspondence). Getting it right here
 * means that flow inherits it rather than reinventing it.
 */
import { createHash, randomBytes } from "node:crypto";

if (typeof window !== "undefined") {
  throw new Error("src/lib/auth/tokens.ts was imported into client code");
}

export const TOKEN_PURPOSES = ["verifyEmail", "resetPassword"] as const;
export type TokenPurpose = (typeof TOKEN_PURPOSES)[number];

/* A reset link is short because it is a live credential sitting in an
 * inbox. Verification is longer because missing it is merely annoying,
 * and a link that dies before someone gets to their email generates a
 * support request rather than a security improvement. */
export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  verifyEmail: 24 * 60 * 60 * 1000, // 24 hours
  resetPassword: 60 * 60 * 1000, //     1 hour
};

/** How many may be requested before we stop sending. Resetting the same
 *  password five times in a row is a person having trouble; fifty is
 *  someone using us to post mail to an address they do not own. */
export const MAX_ACTIVE_TOKENS = 5;

export type AuthToken = {
  tokenHash: string;
  purpose: TokenPurpose;
  userId: string;
  /** The address this was issued against. Compared on use, so a token
   *  cannot survive the account's email changing under it. */
  email: string;
  createdAt: Date;
  expiresAt: Date;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildToken(
  input: { purpose: TokenPurpose; userId: string; email: string },
  now: Date
): { token: string; record: AuthToken } {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    record: {
      tokenHash: hashToken(token),
      purpose: input.purpose,
      userId: input.userId,
      email: input.email.toLowerCase(),
      createdAt: now,
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[input.purpose]),
    },
  };
}

export type TokenInvalidReason = "expired" | "wrong-purpose" | "email-changed";

/** Why this token should be refused, or null if it stands. */
export function tokenInvalidReason(
  record: Pick<AuthToken, "expiresAt" | "purpose" | "email">,
  expected: { purpose: TokenPurpose; email: string },
  now: Date
): TokenInvalidReason | null {
  if (record.purpose !== expected.purpose) return "wrong-purpose";
  if (record.expiresAt <= now) return "expired";
  if (record.email !== expected.email.toLowerCase()) return "email-changed";
  return null;
}
