import { describe, expect, it } from "vitest";
import {
  TOTP_PERIOD_SECONDS,
  base32Decode,
  base32Encode,
  generateSecret,
  generateTotp,
  otpauthUri,
  verifyTotp,
} from "./totp";

/* RFC 6238 Appendix B. The SHA-1 secret is the ASCII string
 * "12345678901234567890"; the published vectors are 8-digit, and the
 * 6-digit code is its last six characters. Testing against the standard
 * rather than against another implementation is the whole reason this is
 * hand-rolled. */
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

const RFC_VECTORS: [seconds: number, eightDigits: string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("base32", () => {
  it("round-trips", () => {
    const bytes = Buffer.from("12345678901234567890", "ascii");
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it("matches the known encoding of the RFC secret", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("ignores padding, spaces and case — people retype these by hand", () => {
    expect(base32Decode("gezd gnbv gy3t qojq")).toEqual(base32Decode("GEZDGNBVGY3TQOJQ"));
  });

  it("refuses characters that are not base32", () => {
    expect(() => base32Decode("GEZD!NBV")).toThrow();
  });
});

describe("generateTotp — RFC 6238 test vectors", () => {
  for (const [seconds, eight] of RFC_VECTORS) {
    it(`t=${seconds} produces ${eight.slice(-6)}`, () => {
      expect(generateTotp(RFC_SECRET, seconds * 1000)).toBe(eight.slice(-6));
    });
  }

  it("is stable across a whole period and changes at the boundary", () => {
    const base = 1111111109 * 1000;
    const step = TOTP_PERIOD_SECONDS * 1000;
    const start = Math.floor(base / step) * step;

    expect(generateTotp(RFC_SECRET, start)).toBe(generateTotp(RFC_SECRET, start + step - 1));
    expect(generateTotp(RFC_SECRET, start)).not.toBe(generateTotp(RFC_SECRET, start + step));
  });

  it("always returns six digits, zero-padded", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateTotp(RFC_SECRET, i * 30_000)).toMatch(/^\d{6}$/);
    }
  });
});

describe("verifyTotp", () => {
  const now = 1111111109 * 1000;

  it("accepts the current code", () => {
    expect(verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now), now)).toBe(true);
  });

  it("allows one step of clock drift either way", () => {
    const step = TOTP_PERIOD_SECONDS * 1000;
    expect(verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now - step), now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now + step), now)).toBe(true);
  });

  it("refuses two steps away", () => {
    const step = TOTP_PERIOD_SECONDS * 1000;
    expect(verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now - 2 * step), now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, generateTotp(RFC_SECRET, now + 2 * step), now)).toBe(false);
  });

  it("refuses anything that is not six digits", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 56", "０１２３４５"]) {
      expect(verifyTotp(RFC_SECRET, bad, now)).toBe(false);
    }
  });

  it("refuses a code from a different secret", () => {
    const other = generateSecret();
    expect(verifyTotp(RFC_SECRET, generateTotp(other, now), now)).toBe(false);
  });

  it("does not throw on rubbish input", () => {
    expect(() => verifyTotp(RFC_SECRET, null as unknown as string, now)).not.toThrow();
  });
});

describe("generateSecret", () => {
  it("is 20 bytes, base32", () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
  });

  it("never repeats", () => {
    expect(new Set(Array.from({ length: 500 }, generateSecret)).size).toBe(500);
  });
});

describe("otpauthUri", () => {
  it("is the shape authenticator apps expect", () => {
    const uri = otpauthUri("GEZDGNBVGY3TQOJQ", "staff@example.com");
    expect(uri).toMatch(/^otpauth:\/\/totp\/NikahCanada%3Astaff%40example\.com\?/);
    expect(uri).toContain("secret=GEZDGNBVGY3TQOJQ");
    expect(uri).toContain("issuer=NikahCanada");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});
