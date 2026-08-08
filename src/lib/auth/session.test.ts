import { describe, expect, it } from "vitest";
import {
  ABSOLUTE_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  STAFF_IDLE_TIMEOUT_MS,
  buildSession,
  hashSessionToken,
  newSessionToken,
  sameToken,
  sessionCookieOptions,
  sessionInvalidReason,
  sessionTimeouts,
  slidIdleDeadline,
} from "./session";

const NOW = new Date("2026-08-08T00:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const ahead = (ms: number) => new Date(NOW.getTime() + ms);

describe("newSessionToken", () => {
  it("is 256 bits of randomness, url-safe", () => {
    const { token } = newSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 500 }, () => newSessionToken().token));
    expect(seen.size).toBe(500);
  });

  it("returns the digest of the token it returns", () => {
    const { token, tokenHash } = newSessionToken();
    expect(tokenHash).toBe(hashSessionToken(token));
    expect(tokenHash).not.toContain(token);
  });
});

describe("sameToken", () => {
  it("matches identical digests", () => {
    const h = hashSessionToken("abc");
    expect(sameToken(h, h)).toBe(true);
  });

  it("rejects different digests, and different lengths without throwing", () => {
    expect(sameToken(hashSessionToken("a"), hashSessionToken("b"))).toBe(false);
    expect(sameToken("short", hashSessionToken("b"))).toBe(false);
  });
});

describe("buildSession", () => {
  it("sets both deadlines from the member timeouts", () => {
    const { record } = buildSession(
      { userId: "u1", tokenVersion: 0, privileged: false },
      NOW
    );
    expect(record.expiresAt).toEqual(ahead(IDLE_TIMEOUT_MS));
    expect(record.absoluteExpiresAt).toEqual(ahead(ABSOLUTE_TIMEOUT_MS));
  });

  it("gives staff a much shorter session — they read private correspondence", () => {
    const { record } = buildSession({ userId: "s1", tokenVersion: 0, privileged: true }, NOW);
    expect(record.expiresAt).toEqual(ahead(STAFF_IDLE_TIMEOUT_MS));
    expect(sessionTimeouts(true).idleMs).toBeLessThan(sessionTimeouts(false).idleMs);
  });

  it("stores only the digest alongside the token it hands out", () => {
    const { token, record } = buildSession(
      { userId: "u1", tokenVersion: 3, privileged: false },
      NOW
    );
    expect(record.tokenHash).toBe(hashSessionToken(token));
    expect(JSON.stringify(record)).not.toContain(token);
  });

  it("carries the account's token version, so a bump can invalidate it", () => {
    const { record } = buildSession({ userId: "u1", tokenVersion: 7, privileged: false }, NOW);
    expect(record.tokenVersion).toBe(7);
  });
});

describe("sessionInvalidReason", () => {
  const live = {
    expiresAt: ahead(1000),
    absoluteExpiresAt: ahead(100_000),
    tokenVersion: 2,
  };

  it("honours a live session", () => {
    expect(sessionInvalidReason(live, 2, NOW)).toBeNull();
  });

  it("rejects one that has been idle too long", () => {
    expect(sessionInvalidReason({ ...live, expiresAt: ago(1) }, 2, NOW)).toBe("idle-expired");
  });

  it("rejects one past its absolute deadline even if recently used", () => {
    expect(
      sessionInvalidReason({ ...live, absoluteExpiresAt: ago(1) }, 2, NOW)
    ).toBe("absolute-expired");
  });

  it("rejects one issued before the account's token version was bumped", () => {
    expect(sessionInvalidReason(live, 3, NOW)).toBe("token-version-stale");
  });

  it("rejects on the deadline itself, not a moment after", () => {
    expect(sessionInvalidReason({ ...live, expiresAt: NOW }, 2, NOW)).toBe("idle-expired");
  });

  it("reports the absolute deadline first when both have passed", () => {
    expect(
      sessionInvalidReason({ ...live, expiresAt: ago(1), absoluteExpiresAt: ago(1) }, 2, NOW)
    ).toBe("absolute-expired");
  });
});

describe("slidIdleDeadline", () => {
  it("does not write for a session used again immediately", () => {
    const s = { expiresAt: ahead(IDLE_TIMEOUT_MS), absoluteExpiresAt: ahead(ABSOLUTE_TIMEOUT_MS) };
    expect(slidIdleDeadline(s, false, NOW)).toBeNull();
  });

  it("slides once the window has drifted by more than an hour", () => {
    const s = {
      expiresAt: ahead(IDLE_TIMEOUT_MS - 2 * 60 * 60 * 1000),
      absoluteExpiresAt: ahead(ABSOLUTE_TIMEOUT_MS),
    };
    expect(slidIdleDeadline(s, false, NOW)).toEqual(ahead(IDLE_TIMEOUT_MS));
  });

  it("never slides an idle deadline past the absolute one", () => {
    const s = { expiresAt: ahead(1000), absoluteExpiresAt: ahead(2 * 60 * 60 * 1000) };
    expect(slidIdleDeadline(s, false, NOW)).toEqual(s.absoluteExpiresAt);
  });
});

describe("sessionCookieOptions", () => {
  it("is httpOnly and lax, so an emailed wali link still carries it", () => {
    const o = sessionCookieOptions(ahead(1000));
    expect(o.httpOnly).toBe(true);
    expect(o.sameSite).toBe("lax");
    expect(o.path).toBe("/");
  });
});
