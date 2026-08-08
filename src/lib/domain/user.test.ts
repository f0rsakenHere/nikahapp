import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD_LENGTH,
  ROLES,
  UserSchema,
  ageOn,
  isLocked,
  isPrivileged,
  lockoutUntil,
  mfaRequired,
  signInBlockedReason,
  validateSignup,
  type Role,
  type SignupInput,
  type User,
} from "./user";

const NOW = new Date("2026-08-08T00:00:00Z");

function signup(over: Partial<SignupInput> = {}): SignupInput {
  return {
    gender: "sister",
    email: "Fatima.A@Example.com",
    password: "a-long-enough-passphrase",
    legalName: { first: "Fatima", last: "Ahmed" },
    dateOfBirth: new Date("1998-04-12T00:00:00Z"),
    locale: "en-CA",
    acceptedMarriageIntention: true,
    acceptedTerms: true,
    ...over,
  };
}

function user(over: Partial<User> = {}): User {
  return {
    id: "u1",
    email: "fatima.a@example.com",
    emailVerifiedAt: NOW,
    passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$abc$def",
    roles: ["member"],
    status: "active",
    locale: "en-CA",
    legalName: { first: "Fatima", last: "Ahmed" },
    phone: null,
    dateOfBirth: new Date("1998-04-12T00:00:00Z"),
    mfa: { enabled: false, secret: null },
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    tokenVersion: 0,
    closedAt: null,
    closureReason: null,
    ...over,
  };
}

describe("roles", () => {
  it("marks the roles that can read private correspondence", () => {
    expect(isPrivileged(["member"])).toBe(false);
    expect(isPrivileged(["wali"])).toBe(false);
    expect(isPrivileged(["member", "staff"])).toBe(true);
    expect(isPrivileged(["verifier"])).toBe(true);
    expect(isPrivileged(["admin"])).toBe(true);
  });

  it("requires 2FA for exactly those roles", () => {
    for (const r of ROLES) {
      expect(mfaRequired([r as Role])).toBe(["staff", "verifier", "admin"].includes(r));
    }
  });

  it("lets one account hold both member and wali — the brother-as-wali case", () => {
    expect(UserSchema.safeParse(user({ roles: ["member", "wali"] })).success).toBe(true);
  });
});

describe("UserSchema", () => {
  it("accepts a well-formed member", () => {
    expect(UserSchema.safeParse(user()).success).toBe(true);
  });

  it("refuses an email that was not lowercased on the way in", () => {
    const result = UserSchema.safeParse(user({ email: "Fatima.A@Example.com" }));
    expect(result.success).toBe(false);
  });

  it("makes a staff account without 2FA unrepresentable", () => {
    const result = UserSchema.safeParse(user({ roles: ["staff"] }));
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0].message).toMatch(/2FA/);
  });

  it("accepts staff once 2FA is on", () => {
    const ok = user({ roles: ["staff"], mfa: { enabled: true, secret: "s" } });
    expect(UserSchema.safeParse(ok).success).toBe(true);
  });

  it("requires a closed account to say when it closed", () => {
    expect(UserSchema.safeParse(user({ status: "closed" })).success).toBe(false);
    expect(
      UserSchema.safeParse(user({ status: "closed", closedAt: NOW, closureReason: "withdrew" }))
        .success
    ).toBe(true);
  });

  it("allows a passwordless account, for a wali who only ever used a link", () => {
    expect(UserSchema.safeParse(user({ passwordHash: null })).success).toBe(true);
  });
});

describe("ageOn", () => {
  it("does not count a birthday still to come this year", () => {
    expect(ageOn(new Date("2008-08-09T00:00:00Z"), NOW)).toBe(17);
  });

  it("counts the birthday itself", () => {
    expect(ageOn(new Date("2008-08-08T00:00:00Z"), NOW)).toBe(18);
  });
});

describe("validateSignup", () => {
  it("accepts a valid sign-up and lowercases the email", () => {
    const result = validateSignup(signup(), NOW);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.email).toBe("fatima.a@example.com");
  });

  it("starts everyone as a member — a wali role is granted, never claimed", () => {
    const result = validateSignup(signup(), NOW);
    expect(result.ok && result.value.roles).toEqual(["member"]);
  });

  it("keeps gender, because it decides whether a wali is required", () => {
    expect(validateSignup(signup({ gender: "brother" }), NOW)).toMatchObject({
      ok: true,
      value: { gender: "brother" },
    });
  });

  it("enforces the age gate on the day before the eighteenth birthday", () => {
    const result = validateSignup(
      signup({ dateOfBirth: new Date("2008-08-09T00:00:00Z") }),
      NOW
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContainEqual({
      field: "dateOfBirth",
      code: "under-age",
    });
  });

  it("admits them on the birthday itself", () => {
    expect(validateSignup(signup({ dateOfBirth: new Date("2008-08-08T00:00:00Z") }), NOW).ok).toBe(
      true
    );
  });

  it("reports every problem at once rather than one per attempt", () => {
    const result = validateSignup(
      signup({
        email: "nope",
        password: "short",
        acceptedTerms: false,
        dateOfBirth: new Date("2015-01-01T00:00:00Z"),
      }),
      NOW
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.field).sort()).toEqual([
      "acceptedTerms",
      "dateOfBirth",
      "email",
      "password",
    ]);
  });

  it("rejects a password containing the email's local part", () => {
    const result = validateSignup(signup({ password: "fatima.a-and-more" }), NOW);
    expect(!result.ok && result.errors).toContainEqual({
      field: "password",
      code: "contains-email",
    });
  });

  it("rejects a long password that is still an obvious one", () => {
    const result = validateSignup(signup({ password: "alhamdulillah" }), NOW);
    expect(!result.ok && result.errors).toContainEqual({ field: "password", code: "too-common" });
  });

  it("bounds password length, because the server pays the hashing cost", () => {
    const result = validateSignup(signup({ password: "x".repeat(MAX_PASSWORD_LENGTH + 1) }), NOW);
    expect(!result.ok && result.errors).toContainEqual({ field: "password", code: "too-long" });
  });

  it("will not accept a sign-up without the marriage-only declaration", () => {
    const result = validateSignup(
      signup({ acceptedMarriageIntention: false }),
      NOW
    );
    expect(!result.ok && result.errors).toContainEqual({
      field: "acceptedMarriageIntention",
      code: "required",
    });
  });

  it("does not accept an unparseable date of birth", () => {
    const result = validateSignup(signup({ dateOfBirth: new Date("nonsense") }), NOW);
    expect(!result.ok && result.errors).toContainEqual({
      field: "dateOfBirth",
      code: "implausible",
    });
  });
});

describe("lockoutUntil", () => {
  it("does not punish a couple of mistyped attempts", () => {
    expect(lockoutUntil(1, NOW)).toBeNull();
    expect(lockoutUntil(4, NOW)).toBeNull();
  });

  it("climbs as the attempts continue", () => {
    const minutes = (n: number) =>
      (lockoutUntil(n, NOW)!.getTime() - NOW.getTime()) / 60_000;
    expect(minutes(5)).toBe(1);
    expect(minutes(7)).toBe(5);
    expect(minutes(10)).toBe(30);
    expect(minutes(15)).toBe(240);
  });

  it("stays at the top of the ladder rather than growing without bound", () => {
    expect(lockoutUntil(400, NOW)).toEqual(lockoutUntil(15, NOW));
  });
});

describe("isLocked", () => {
  it("is false once the lock has elapsed", () => {
    expect(isLocked({ lockedUntil: new Date(NOW.getTime() - 1) }, NOW)).toBe(false);
  });

  it("is true while it has not", () => {
    expect(isLocked({ lockedUntil: new Date(NOW.getTime() + 1) }, NOW)).toBe(true);
  });
});

describe("signInBlockedReason", () => {
  const base = { status: "active" as const, lockedUntil: null, passwordHash: "h" };

  it("permits an ordinary active account", () => {
    expect(signInBlockedReason(base, NOW)).toBeNull();
  });

  it("reports closure ahead of suspension and locking", () => {
    expect(
      signInBlockedReason(
        { ...base, status: "closed", lockedUntil: new Date(NOW.getTime() + 1000) },
        NOW
      )
    ).toBe("closed");
  });

  it("reports a suspension", () => {
    expect(signInBlockedReason({ ...base, status: "suspended" }, NOW)).toBe("suspended");
  });

  it("reports a live lockout", () => {
    expect(
      signInBlockedReason({ ...base, lockedUntil: new Date(NOW.getTime() + 1000) }, NOW)
    ).toBe("locked");
  });

  it("reports an account that has no password to check against", () => {
    expect(signInBlockedReason({ ...base, passwordHash: null }, NOW)).toBe("no-password-set");
  });
});
