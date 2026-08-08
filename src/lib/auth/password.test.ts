import { describe, expect, it } from "vitest";
import { equalisePasswordTiming, hashPassword, needsRehash, verifyPassword } from "./password";

const PASSWORD = "a-long-enough-passphrase";

describe("hashPassword", () => {
  it("produces an argon2id hash", async () => {
    expect(await hashPassword(PASSWORD)).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it("salts, so the same password never hashes the same way twice", async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it("refuses an empty password rather than storing a hash of nothing", async () => {
    await expect(hashPassword("")).rejects.toThrow();
  });
});

describe("verifyPassword", () => {
  it("accepts the right password", async () => {
    expect(await verifyPassword(await hashPassword(PASSWORD), PASSWORD)).toBe(true);
  });

  it("rejects the wrong one", async () => {
    expect(await verifyPassword(await hashPassword(PASSWORD), "not-it-at-all")).toBe(false);
  });

  it("is not fooled by a truncation of the right one", async () => {
    expect(await verifyPassword(await hashPassword(PASSWORD), PASSWORD.slice(0, -1))).toBe(false);
  });

  it("returns false on a corrupted stored hash instead of throwing", async () => {
    expect(await verifyPassword("not-a-hash", PASSWORD)).toBe(false);
    expect(await verifyPassword("$argon2id$broken", PASSWORD)).toBe(false);
  });

  it("returns false rather than throwing on empty input", async () => {
    expect(await verifyPassword("", PASSWORD)).toBe(false);
    expect(await verifyPassword(await hashPassword(PASSWORD), "")).toBe(false);
  });

  it("handles a long unicode passphrase", async () => {
    const p = "لا إله إلا الله محمد رسول الله ١٢٣";
    expect(await verifyPassword(await hashPassword(p), p)).toBe(true);
    expect(await verifyPassword(await hashPassword(p), p + " ")).toBe(false);
  });
});

describe("needsRehash", () => {
  it("leaves a current hash alone", async () => {
    expect(needsRehash(await hashPassword(PASSWORD))).toBe(false);
  });

  it("flags a hash made with less memory", () => {
    expect(needsRehash("$argon2id$v=19$m=4096,t=2,p=1$abc$def")).toBe(true);
  });

  it("flags a hash made with fewer iterations", () => {
    expect(needsRehash("$argon2id$v=19$m=19456,t=1,p=1$abc$def")).toBe(true);
  });

  it("flags anything that is not argon2id", () => {
    expect(needsRehash("$2b$12$abcdefghijklmnopqrstuv")).toBe(true);
    expect(needsRehash("")).toBe(true);
  });
});

describe("equalisePasswordTiming", () => {
  it("always reports failure", async () => {
    expect(await equalisePasswordTiming("anything at all")).toBe(false);
  });

  it("costs roughly what a real verification costs", async () => {
    const real = await hashPassword(PASSWORD);

    const t0 = performance.now();
    await verifyPassword(real, "wrong-password-entirely");
    const realMs = performance.now() - t0;

    const t1 = performance.now();
    await equalisePasswordTiming("wrong-password-entirely");
    const decoyMs = performance.now() - t1;

    /* Deliberately loose: this asserts the decoy does the work at all,
       not that it matches to the millisecond. A missing decoy would come
       back in microseconds against argon2's tens of milliseconds. */
    expect(decoyMs).toBeGreaterThan(realMs / 4);
  });
});
