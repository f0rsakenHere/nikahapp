/* TOTP, RFC 6238. Mandatory for staff and admin accounts (§7.1).
 *
 * Implemented here rather than pulled in, for three reasons: it is about
 * sixty lines of HMAC, `node:crypto` has everything it needs, and the
 * RFC publishes test vectors — so this can be verified against the
 * standard itself rather than against another library's behaviour.
 *
 * Base32 is hand-rolled for the same reason: it is the encoding
 * authenticator apps expect, and it is twenty lines.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

if (typeof window !== "undefined") {
  throw new Error("src/lib/auth/totp.ts was imported into client code");
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;

/* One step either side of now. Phone clocks drift, and people finish
 * typing a code a second after it rotates; ±1 is the usual allowance.
 * Wider would meaningfully enlarge the guessing window. */
export const TOTP_WINDOW = 1;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`not base32: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh shared secret, base32 for the authenticator app. 20 bytes is
 *  what RFC 4226 specifies for HMAC-SHA1. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The code for one time step. */
export function generateTotp(secret: string, atMs: number): string {
  const counter = Math.floor(atMs / 1000 / TOTP_PERIOD_SECONDS);

  const buffer = Buffer.alloc(8);
  /* 64-bit big-endian counter. Written as two 32-bit halves because
   * `writeBigUInt64BE` would need the counter as a BigInt for a value
   * that will not exceed 2^32 until the year 6053. */
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();

  /* Dynamic truncation, RFC 4226 §5.3. */
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

/** Whether a code is valid now, allowing for clock drift.
 *
 *  Constant-time comparison. A timing difference here leaks which digits
 *  were right, which turns a million-guess space into six thousand. */
export function verifyTotp(secret: string, code: string, atMs: number): boolean {
  const candidate = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(candidate)) return false;

  const given = Buffer.from(candidate, "utf8");
  let ok = false;

  for (let step = -TOTP_WINDOW; step <= TOTP_WINDOW; step++) {
    const expected = Buffer.from(
      generateTotp(secret, atMs + step * TOTP_PERIOD_SECONDS * 1000),
      "utf8"
    );
    /* No early exit: comparing every step regardless keeps the work
     * constant whichever one matches. */
    if (timingSafeEqual(expected, given)) ok = true;
  }
  return ok;
}

/** The `otpauth://` URI an authenticator app reads from a QR code, or
 *  that can be typed in by hand. */
export function otpauthUri(secret: string, email: string, issuer = "NikahCanada"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
