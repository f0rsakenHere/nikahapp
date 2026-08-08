import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  AuditEntrySchema,
  findSecrets,
  visibleToWali,
} from "./audit";

const NOW = new Date("2026-08-08T00:00:00Z");

function entry(over: Record<string, unknown> = {}) {
  return {
    at: NOW,
    actor: { userId: "u1", role: "member", ip: null, userAgent: null, impersonatedBy: null },
    action: "profile.submitted",
    subject: { type: "profile", id: "p1" },
    meta: {},
    ...over,
  };
}

describe("AuditEntrySchema", () => {
  it("accepts a well-formed entry", () => {
    expect(AuditEntrySchema.safeParse(entry()).success).toBe(true);
  });

  it("allows a system actor with nobody behind it", () => {
    const system = entry({
      actor: { userId: null, role: null, ip: null, userAgent: null, impersonatedBy: null },
    });
    expect(AuditEntrySchema.safeParse(system).success).toBe(true);
  });

  it("refuses an action outside the closed list", () => {
    expect(AuditEntrySchema.safeParse(entry({ action: "something.new" })).success).toBe(false);
  });

  it("refuses a subject type outside the closed list", () => {
    const bad = entry({ subject: { type: "invoice", id: "x" } });
    expect(AuditEntrySchema.safeParse(bad).success).toBe(false);
  });

  it("covers the actions the wali portal promises to log", () => {
    for (const action of ["guardianship.confirmed", "profile.submitted", "account.signedIn"]) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
  });
});

describe("findSecrets", () => {
  it("passes ordinary metadata", () => {
    expect(findSecrets({ email: "a@b.com", stepsDone: 3, gender: "sister" })).toEqual([]);
  });

  it("catches a forbidden key however it is spelled", () => {
    for (const key of ["password", "passwordHash", "password_hash", "resetToken", "tokenHash", "mfaSecret", "otpCode"]) {
      expect(findSecrets({ [key]: "x" })).toHaveLength(1);
    }
  });

  it("catches a token hiding under an innocent key", () => {
    /* Built rather than typed: 32 bytes as base64url is exactly 43
       characters, which is the shape of every token in this codebase,
       and hand-writing one is how you end up asserting against 44. */
    const token = Buffer.alloc(32, 7).toString("base64url");
    expect(token).toHaveLength(43);

    const leaks = findSecrets({ note: token });
    expect(leaks).toHaveLength(1);
    expect(leaks[0].reason).toBe("looks-like-a-secret");
  });

  it("catches a hex digest", () => {
    expect(findSecrets({ value: "a".repeat(64) })[0].reason).toBe("looks-like-a-secret");
  });

  it("looks inside nested objects and reports the path", () => {
    expect(findSecrets({ wali: { invited: { token: "x" } } })[0].key).toBe("wali.invited.token");
  });

  it("does not flag a short identifier that merely looks technical", () => {
    expect(findSecrets({ profileId: "68a1f2c3d4e5f6a7b8c9d0e1" })).toEqual([]);
  });

  it("does not flag a link-free sentence", () => {
    expect(findSecrets({ reason: "she asked us to pause her profile" })).toEqual([]);
  });
});

describe("visibleToWali", () => {
  it("shows him the guardianship and profile events", () => {
    expect(visibleToWali("guardianship.confirmed")).toBe(true);
    expect(visibleToWali("profile.approved")).toBe(true);
  });

  it("does not show him her account activity", () => {
    expect(visibleToWali("account.signedIn")).toBe(false);
    expect(visibleToWali("account.passwordChanged")).toBe(false);
  });

  it("never shows him what staff read", () => {
    expect(visibleToWali("staff.viewedIdentityDocuments")).toBe(false);
    expect(visibleToWali("staff.viewedLegalName")).toBe(false);
    expect(visibleToWali("staff.impersonationStarted")).toBe(false);
  });
});
