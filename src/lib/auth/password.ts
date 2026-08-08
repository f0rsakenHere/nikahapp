/* Password hashing.
 *
 * Argon2id, per docs/APP-PLAN.md §7.1. `@node-rs/argon2` ships prebuilt
 * binaries, so there is no compiler in the install path.
 *
 * Server only — this is the one place a plaintext password exists in
 * memory, and it must never reach a bundle sent to a browser.
 */
import { hash, verify } from "@node-rs/argon2";

/* `@node-rs/argon2` declares `Algorithm` as an ambient `const enum`,
 * which `isolatedModules` forbids importing — TypeScript cannot inline
 * the value when compiling this file alone. The numeric values are fixed
 * by the argon2 specification (d=0, i=1, id=2) and the first test in
 * password.test.ts asserts the produced hash actually says `$argon2id$`,
 * so a silent change of algorithm cannot slip through. */
const ARGON2ID = 2;

if (typeof window !== "undefined") {
  throw new Error("src/lib/auth/password.ts was imported into client code");
}

/* OWASP's Argon2id baseline (19 MiB, 2 iterations, 1 lane). Raising the
 * memory cost is the meaningful lever if this ever needs strengthening;
 * raising iterations is not. Changing these does not invalidate existing
 * hashes — the parameters are encoded in the hash string itself, which
 * is what makes `needsRehash` below possible. */
const PARAMS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  if (!plain) throw new Error("refusing to hash an empty password");
  return hash(plain, PARAMS);
}

/** Constant-time inside argon2. Returns false rather than throwing on a
 *  malformed stored hash, so a corrupted record is a failed login rather
 *  than a 500 that tells an attacker they found something interesting. */
export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  if (!storedHash || !plain) return false;
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}

/** True when a stored hash was made with weaker parameters than we use
 *  now. Call after a *successful* verify — that is the only moment the
 *  plaintext is available to re-hash with. */
export function needsRehash(storedHash: string): boolean {
  const m = storedHash.match(/^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)/);
  if (!m) return true; // not argon2id at all, or unparseable
  return (
    Number(m[1]) < PARAMS.memoryCost ||
    Number(m[2]) < PARAMS.timeCost ||
    Number(m[3]) !== PARAMS.parallelism
  );
}

/* A hash of a value no password can equal, used to spend the same time
 * verifying a non-existent account as a real one. Without this, login
 * response time answers "does this address have an account here" —
 * which for a matrimonial service is a disclosure that matters well
 * beyond the usual account-enumeration argument. */
let decoyHash: string | null = null;

export async function equalisePasswordTiming(plain: string): Promise<false> {
  decoyHash ??= await hashPassword("decoy-for-timing-equalisation-only");
  await verifyPassword(decoyHash, plain);
  return false;
}
