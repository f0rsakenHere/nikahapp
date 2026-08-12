import { describe, expect, it } from "vitest";
import { COLLECTIONS } from "@/lib/db/collections";
import {
  ERASURE_PLAN,
  nextStatus,
  pseudonymiseEntry,
  redactForExport,
} from "./lifecycle";
import { PROFILE_STATUSES, type ProfileStatus } from "./profile";

describe("pause, resume, withdraw", () => {
  it("pauses a live profile and brings it back", () => {
    const paused = nextStatus("live", "pause");
    expect(paused).toEqual({ ok: true, status: "paused" });
    expect(nextStatus("paused", "resume")).toEqual({ ok: true, status: "live" });
  });

  it("will not pause a draft — there is nothing to pause it from", () => {
    const result = nextStatus("draft", "pause");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe("cannot-pause");
  });

  it("will not resume something that was never paused", () => {
    expect(nextStatus("live", "resume")).toEqual({ ok: false, error: "not-paused" });
  });

  /* Under deferred approval a member is in the pool before anybody has
     approved them, so they must be able to stop being seen without
     withdrawing — which is the only other way out, and permanent. */
  it("pauses a profile that has been sent in but not approved", () => {
    for (const status of ["pendingCall", "pendingReview", "verifying"] as ProfileStatus[]) {
      expect(nextStatus(status, "pause")).toEqual({ ok: true, status: "paused" });
    }
  });

  /* The trap: resuming used to mean "go live", which would hand an
     approval to somebody still waiting for one. */
  it("resumes to where they paused from, never to live by default", () => {
    expect(nextStatus("paused", "resume", "pendingReview")).toEqual({
      ok: true,
      status: "pendingReview",
    });
    expect(nextStatus("paused", "resume", "verifying")).toEqual({
      ok: true,
      status: "verifying",
    });
    /* Nothing recorded — every profile paused before this was kept. */
    expect(nextStatus("paused", "resume")).toEqual({ ok: true, status: "live" });
    /* And a nonsense one cannot smuggle a status in. */
    expect(nextStatus("paused", "resume", "withdrawn")).toEqual({ ok: true, status: "live" });
  });

  it("lets someone withdraw from anywhere, including halfway through", () => {
    for (const status of ["draft", "pendingReview", "verifying", "live", "paused"] as ProfileStatus[]) {
      expect(nextStatus(status, "withdraw")).toEqual({ ok: true, status: "withdrawn" });
    }
  });

  it("refuses anything once they are already gone", () => {
    for (const status of ["withdrawn", "rejected"] as ProfileStatus[]) {
      for (const event of ["pause", "resume", "withdraw"] as const) {
        const result = nextStatus(status, event);
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error).toBe("already-gone");
      }
    }
  });

  it("never invents a status the profile schema does not know", () => {
    for (const status of PROFILE_STATUSES) {
      for (const event of ["pause", "resume", "withdraw"] as const) {
        const result = nextStatus(status, event);
        if (result.ok) expect(PROFILE_STATUSES).toContain(result.status);
      }
    }
  });
});

describe("ERASURE_PLAN", () => {
  it("has decided about every collection that holds personal data", () => {
    /* A collection missing from the plan is a collection nobody decided
       about, which is exactly how personal data survives an erasure
       request. `notifications`, `reports` and the rest join this list as
       they are built. */
    const covered = new Set(Object.keys(ERASURE_PLAN));
    for (const name of [
      COLLECTIONS.users,
      COLLECTIONS.profiles,
      COLLECTIONS.sessions,
      COLLECTIONS.verificationTokens,
      COLLECTIONS.verifications,
      COLLECTIONS.guardianships,
      COLLECTIONS.auditLog,
    ]) {
      expect(covered.has(name)).toBe(true);
    }
  });

  it("keeps the audit log rather than deleting from it", () => {
    expect(ERASURE_PLAN.auditLog).toBe("pseudonymise");
    for (const [name, action] of Object.entries(ERASURE_PLAN)) {
      if (name !== "auditLog") expect(action).toBe("delete");
    }
  });
});

describe("pseudonymiseEntry", () => {
  const entry = { actor: { userId: "erased" }, subject: { id: "erased" } };

  it("removes the person and keeps the record", () => {
    const result = pseudonymiseEntry(entry, "erased", "anon-abc");
    expect(result.actorUserId).toBe("anon-abc");
    expect(result.subjectId).toBe("anon-abc");
    expect(result.meta).toEqual({});
  });

  it("leaves other people's identifiers alone", () => {
    const staffDidIt = { actor: { userId: "staff-1" }, subject: { id: "erased" } };
    const result = pseudonymiseEntry(staffDidIt, "erased", "anon-abc");
    expect(result.actorUserId).toBe("staff-1");
    expect(result.subjectId).toBe("anon-abc");
  });

  it("leaves a system actor null rather than inventing one", () => {
    const system = { actor: { userId: null }, subject: { id: "erased" } };
    expect(pseudonymiseEntry(system, "erased", "anon-abc").actorUserId).toBeNull();
  });

  it("uses one pseudonym, so their entries still group together", () => {
    const a = pseudonymiseEntry(entry, "erased", "anon-abc");
    const b = pseudonymiseEntry({ actor: { userId: "erased" }, subject: { id: "p1" } }, "erased", "anon-abc");
    expect(a.actorUserId).toBe(b.actorUserId);
  });
});

describe("redactForExport", () => {
  it("keeps ordinary fields", () => {
    expect(redactForExport({ email: "a@b.com", roles: ["member"] })).toEqual({
      email: "a@b.com",
      roles: ["member"],
    });
  });

  it("never hands back a credential, even to its owner", () => {
    /* They will email this file to themselves. */
    const doc = {
      email: "a@b.com",
      passwordHash: "$argon2id$...",
      mfa: { enabled: true, secret: "GEZD" },
      tokenHash: "abc",
      _id: "x",
    };
    const out = redactForExport(doc);
    expect(out).toEqual({ email: "a@b.com" });
    expect(JSON.stringify(out)).not.toContain("argon2");
    expect(JSON.stringify(out)).not.toContain("GEZD");
  });

  it("reaches into nested objects", () => {
    const out = redactForExport({ invited: { name: "Ahmed", tokenHash: "abc" } });
    expect(out).toEqual({ invited: { name: "Ahmed" } });
  });

  it("leaves dates and arrays intact", () => {
    const at = new Date("2026-08-08T00:00:00Z");
    expect(redactForExport({ at, languages: ["English"] })).toEqual({
      at,
      languages: ["English"],
    });
  });
});
