import { describe, expect, it } from "vitest";
import {
  TOKEN_TTL_MS,
  buildToken,
  hashToken,
  tokenInvalidReason,
  type AuthToken,
} from "./tokens";

const NOW = new Date("2026-08-08T00:00:00Z");
const ahead = (ms: number) => new Date(NOW.getTime() + ms);

describe("buildToken", () => {
  it("is 256 bits of randomness, url-safe", () => {
    const { token } = buildToken({ purpose: "resetPassword", userId: "u1", email: "a@b.com" }, NOW);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("stores only the digest", () => {
    const { token, record } = buildToken(
      { purpose: "verifyEmail", userId: "u1", email: "a@b.com" },
      NOW
    );
    expect(record.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(record)).not.toContain(token);
  });

  it("never repeats", () => {
    const seen = new Set(
      Array.from(
        { length: 300 },
        () => buildToken({ purpose: "verifyEmail", userId: "u", email: "a@b.com" }, NOW).token
      )
    );
    expect(seen.size).toBe(300);
  });

  it("lowercases the address it is bound to", () => {
    const { record } = buildToken(
      { purpose: "resetPassword", userId: "u1", email: "Fatima.A@Example.com" },
      NOW
    );
    expect(record.email).toBe("fatima.a@example.com");
  });

  it("gives a reset link a much shorter life than a verification link", () => {
    expect(TOKEN_TTL_MS.resetPassword).toBeLessThan(TOKEN_TTL_MS.verifyEmail);
    const reset = buildToken({ purpose: "resetPassword", userId: "u", email: "a@b.com" }, NOW);
    expect(reset.record.expiresAt).toEqual(ahead(60 * 60 * 1000));
  });
});

describe("tokenInvalidReason", () => {
  const record: Pick<AuthToken, "expiresAt" | "purpose" | "email"> = {
    expiresAt: ahead(1000),
    purpose: "resetPassword",
    email: "a@b.com",
  };
  const expected = { purpose: "resetPassword" as const, email: "a@b.com" };

  it("honours a live token", () => {
    expect(tokenInvalidReason(record, expected, NOW)).toBeNull();
  });

  it("refuses an expired one, on the deadline itself", () => {
    expect(tokenInvalidReason({ ...record, expiresAt: NOW }, expected, NOW)).toBe("expired");
  });

  it("refuses a verification token used to reset a password", () => {
    expect(tokenInvalidReason({ ...record, purpose: "verifyEmail" }, expected, NOW)).toBe(
      "wrong-purpose"
    );
  });

  it("refuses a token issued to an address the account no longer uses", () => {
    expect(
      tokenInvalidReason({ ...record, email: "old@b.com" }, expected, NOW)
    ).toBe("email-changed");
  });

  it("compares addresses case-insensitively", () => {
    expect(tokenInvalidReason(record, { ...expected, email: "A@B.com" }, NOW)).toBeNull();
  });

  it("checks the purpose before the expiry, so a misuse is never hidden by age", () => {
    const stale = { ...record, purpose: "verifyEmail" as const, expiresAt: NOW };
    expect(tokenInvalidReason(stale, expected, NOW)).toBe("wrong-purpose");
  });
});
