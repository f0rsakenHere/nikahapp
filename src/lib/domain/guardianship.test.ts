/* Guardianship lifecycle and authorisation.
 *
 * The illegal transitions are tested as hard as the legal ones — every
 * state × every event is asserted, so adding a state or an event without
 * deciding what it means fails here rather than shipping.
 *
 * The authorisation block matters more than the state machine. §7.2: "a
 * wali reading another family's conversation is a catastrophic bug, not a
 * defect." Those tests are written to fail if the check is ever loosened
 * to "is he a confirmed wali" without also asking "of her".
 */
import { describe, expect, it } from "vitest";
import {
  GUARDIANSHIP_STATES,
  GuardianshipSchema,
  TERMINAL_STATES,
  activeGuardianship,
  canWaliAct,
  canWaliReadConversation,
  isActive,
  profileMayGoLive,
  transition,
  type Guardianship,
  type GuardianshipEvent,
  type GuardianshipState,
  type TransitionContext,
} from "./guardianship";

const INVITED_AT = new Date("2026-08-01T10:00:00Z");
const EXPIRES_AT = new Date("2026-08-15T10:00:00Z");
const NOW = new Date("2026-08-08T10:00:00Z");
const AFTER_EXPIRY = new Date("2026-08-16T10:00:00Z");

const CTX: TransitionContext = { memberHasOtherConfirmedWali: false, maxReminders: 3 };

function make(over: Partial<Guardianship> = {}): Guardianship {
  return {
    id: "g1",
    memberUserId: "member-1",
    memberProfileId: "profile-1",
    waliUserId: null,
    invited: {
      name: "Ahmed Al-Rashid",
      relationship: "Father",
      email: "wali@example.com",
      phone: "+15140000000",
      invitedAt: INVITED_AT,
      token: "0123456789abcdef0123",
      expiresAt: EXPIRES_AT,
      remindersSent: 0,
    },
    status: "invited",
    confirmedAt: null,
    declinedAt: null,
    declineReason: null,
    revokedAt: null,
    revokedBy: null,
    expiredAt: null,
    verification: { state: "unverified", verifiedAt: null, method: null },
    replacesGuardianshipId: null,
    replacedByGuardianshipId: null,
    ...over,
  };
}

function confirmed(over: Partial<Guardianship> = {}): Guardianship {
  return make({
    status: "confirmed",
    waliUserId: "wali-1",
    confirmedAt: NOW,
    verification: { state: "verified", verifiedAt: NOW, method: "document" },
    ...over,
  });
}

/* ------------------------------------------------------------- schema --- */

describe("GuardianshipSchema", () => {
  it("accepts a well-formed invitation", () => {
    expect(GuardianshipSchema.safeParse(make()).success).toBe(true);
  });

  it("refuses to let a member be their own wali", () => {
    const bad = make({ waliUserId: "member-1" });
    const result = GuardianshipSchema.safeParse(bad);
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0].message).toMatch(/own wali/);
  });

  it("makes a confirmed guardianship with no wali account unrepresentable", () => {
    const bad = make({ status: "confirmed", waliUserId: null, confirmedAt: NOW });
    expect(GuardianshipSchema.safeParse(bad).success).toBe(false);
  });

  it("makes a confirmed guardianship with no confirmation time unrepresentable", () => {
    const bad = make({ status: "confirmed", waliUserId: "wali-1", confirmedAt: null });
    expect(GuardianshipSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a guessable invitation token", () => {
    const bad = make({ invited: { ...make().invited, token: "abc" } });
    expect(GuardianshipSchema.safeParse(bad).success).toBe(false);
  });
});

/* -------------------------------------------------- the whole matrix --- */

const EVENTS: Record<GuardianshipEvent["type"], GuardianshipEvent> = {
  accept: { type: "accept", at: NOW, waliUserId: "wali-1" },
  decline: { type: "decline", at: NOW },
  expire: { type: "expire", at: AFTER_EXPIRY },
  remind: { type: "remind", at: NOW },
  revoke: { type: "revoke", at: NOW, by: "staff-1" },
  replace: { type: "replace", at: NOW, replacedByGuardianshipId: "g2" },
};

/* The intended table, written out rather than derived, so that changing
 * the implementation cannot quietly change the specification too. */
const LEGAL: Record<GuardianshipState, GuardianshipEvent["type"][]> = {
  invited: ["accept", "decline", "expire", "remind", "revoke"],
  confirmed: ["revoke", "replace"],
  declined: [],
  expired: [],
  revoked: [],
  replaced: [],
};

describe("transition — every state against every event", () => {
  for (const state of GUARDIANSHIP_STATES) {
    for (const type of Object.keys(EVENTS) as GuardianshipEvent["type"][]) {
      const legal = LEGAL[state].includes(type);

      it(`${state} + ${type} is ${legal ? "allowed" : "REJECTED"}`, () => {
        const g =
          state === "confirmed"
            ? confirmed()
            : make({
                status: state,
                ...(state === "declined" ? { declinedAt: NOW } : {}),
                ...(state === "expired" ? { expiredAt: AFTER_EXPIRY } : {}),
                ...(state === "revoked" ? { revokedAt: NOW, revokedBy: "staff-1" } : {}),
                ...(state === "replaced" ? { replacedByGuardianshipId: "g2" } : {}),
              });

        const result = transition(g, EVENTS[type], CTX);
        if (legal) {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
          expect(!result.ok && result.error).toBe("illegal-transition");
        }
      });
    }
  }

  it("leaves every terminal state closed", () => {
    for (const state of TERMINAL_STATES) {
      expect(LEGAL[state]).toEqual([]);
    }
  });
});

/* -------------------------------------------------------------- guards -- */

describe("accept", () => {
  it("confirms the guardianship and records who and when", () => {
    const result = transition(make(), EVENTS.accept, CTX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.status).toBe("confirmed");
    expect(result.next.waliUserId).toBe("wali-1");
    expect(result.next.confirmedAt).toEqual(NOW);
    expect(GuardianshipSchema.safeParse(result.next).success).toBe(true);
  });

  it("refuses an expired invitation — the link in an old email is a credential", () => {
    const result = transition(make(), { type: "accept", at: AFTER_EXPIRY, waliUserId: "w" }, CTX);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe("invitation-expired");
  });

  it("refuses on the expiry instant itself, not a moment later", () => {
    const at = new Date(EXPIRES_AT);
    const result = transition(make(), { type: "accept", at, waliUserId: "w" }, CTX);
    expect(!result.ok && result.error).toBe("invitation-expired");
  });

  it("refuses to let the member accept as her own wali", () => {
    const result = transition(make(), { type: "accept", at: NOW, waliUserId: "member-1" }, CTX);
    expect(!result.ok && result.error).toBe("wali-cannot-be-the-member");
  });

  it("refuses a second wali while one is confirmed", () => {
    const result = transition(make(), EVENTS.accept, { ...CTX, memberHasOtherConfirmedWali: true });
    expect(!result.ok && result.error).toBe("member-already-has-confirmed-wali");
  });

  it("does not mutate the input", () => {
    const g = make();
    transition(g, EVENTS.accept, CTX);
    expect(g.status).toBe("invited");
    expect(g.waliUserId).toBeNull();
  });
});

describe("expire", () => {
  it("will not expire an invitation that is still live", () => {
    const result = transition(make(), { type: "expire", at: NOW }, CTX);
    expect(!result.ok && result.error).toBe("not-yet-expired");
  });

  it("expires once the window has passed", () => {
    const result = transition(make(), EVENTS.expire, CTX);
    expect(result.ok && result.next.status).toBe("expired");
  });
});

describe("remind", () => {
  it("counts reminders without changing state", () => {
    const result = transition(make(), EVENTS.remind, CTX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.status).toBe("invited");
    expect(result.next.invited.remindersSent).toBe(1);
  });

  it("stops at the cadence limit rather than nagging indefinitely", () => {
    const g = make({ invited: { ...make().invited, remindersSent: 3 } });
    const result = transition(g, EVENTS.remind, CTX);
    expect(!result.ok && result.error).toBe("reminder-limit-reached");
  });
});

describe("revoke", () => {
  it("records who removed him, so staff can tell why the link ended", () => {
    const result = transition(confirmed(), { type: "revoke", at: NOW, by: "staff-1" }, CTX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.status).toBe("revoked");
    expect(result.next.revokedBy).toBe("staff-1");
  });

  it("is how a wali steps down — not `decline`, which stays 'never served'", () => {
    const result = transition(confirmed(), { type: "revoke", at: NOW, by: "wali-1" }, CTX);
    expect(result.ok && result.next.revokedBy).toBe("wali-1");
    expect(result.ok && result.next.status).toBe("revoked");
  });

  it("refuses `decline` from confirmed, so the two remain distinguishable", () => {
    const result = transition(confirmed(), { type: "decline", at: NOW }, CTX);
    expect(!result.ok && result.error).toBe("illegal-transition");
  });
});

describe("replace", () => {
  it("links the superseding guardianship", () => {
    const result = transition(confirmed(), EVENTS.replace, CTX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.status).toBe("replaced");
    expect(result.next.replacedByGuardianshipId).toBe("g2");
  });

  it("refuses a replacement that names no successor", () => {
    const result = transition(
      confirmed(),
      { type: "replace", at: NOW, replacedByGuardianshipId: "" },
      CTX
    );
    expect(!result.ok && result.error).toBe("missing-replacement");
  });
});

/* ------------------------------------------------------ authorisation --- */

describe("activeGuardianship", () => {
  it("finds the confirmed one among the dead ones", () => {
    const all = [make({ status: "declined", id: "old" }), confirmed({ id: "current" })];
    const result = activeGuardianship(all);
    expect(result.ok && result.guardianship?.id).toBe("current");
  });

  it("returns null when nobody has confirmed", () => {
    const result = activeGuardianship([make()]);
    expect(result.ok && result.guardianship).toBeNull();
  });

  it("errors rather than picking one when two are confirmed", () => {
    const result = activeGuardianship([confirmed({ id: "a" }), confirmed({ id: "b" })]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe("multiple-confirmed-guardianships");
  });
});

describe("canWaliAct — the catastrophic cases", () => {
  const g = confirmed();
  const HER = { waliUserId: "wali-1", memberUserId: "member-1" };

  it("lets the confirmed wali act for his own ward", () => {
    expect(canWaliAct(g, HER)).toBe(true);
  });

  it("refuses another family's wali holding this guardianship", () => {
    expect(canWaliAct(g, { waliUserId: "wali-2", memberUserId: "member-1" })).toBe(false);
  });

  it("refuses the right wali against the wrong ward", () => {
    expect(canWaliAct(g, { waliUserId: "wali-1", memberUserId: "member-2" })).toBe(false);
  });

  it("refuses once he has been revoked", () => {
    expect(canWaliAct(confirmed({ status: "revoked", revokedAt: NOW, revokedBy: "s" }), HER)).toBe(
      false
    );
  });

  it("refuses while the invitation is merely invited", () => {
    expect(canWaliAct(make(), { waliUserId: "wali-1", memberUserId: "member-1" })).toBe(false);
  });

  it("refuses after he has been replaced", () => {
    expect(
      canWaliAct(confirmed({ status: "replaced", replacedByGuardianshipId: "g2" }), HER)
    ).toBe(false);
  });

  it("is false for every non-confirmed state", () => {
    for (const status of GUARDIANSHIP_STATES) {
      if (status === "confirmed") continue;
      expect(canWaliAct(confirmed({ status }), HER)).toBe(false);
    }
  });
});

describe("canWaliReadConversation — D11, a replacement starts fresh", () => {
  const HANDOVER = new Date("2026-06-01T00:00:00Z");
  const g = confirmed({ confirmedAt: HANDOVER, replacesGuardianshipId: "g0" });
  const HER = { waliUserId: "wali-1", memberUserId: "member-1" };

  it("lets him read a conversation opened after he took the role", () => {
    expect(
      canWaliReadConversation(g, HER, { openedAt: new Date("2026-06-02T00:00:00Z") })
    ).toBe(true);
  });

  it("keeps the previous wali's correspondence closed to him", () => {
    expect(
      canWaliReadConversation(g, HER, { openedAt: new Date("2026-05-30T00:00:00Z") })
    ).toBe(false);
  });

  it("includes a conversation opened at the moment of handover", () => {
    expect(canWaliReadConversation(g, HER, { openedAt: HANDOVER })).toBe(true);
  });

  it("still refuses another family's conversation regardless of timing", () => {
    expect(
      canWaliReadConversation(g, { waliUserId: "wali-1", memberUserId: "member-2" }, {
        openedAt: new Date("2026-07-01T00:00:00Z"),
      })
    ).toBe(false);
  });
});

describe("profileMayGoLive", () => {
  it("lets a brother through without a guardianship", () => {
    expect(profileMayGoLive("brother", [])).toEqual({ ok: true });
  });

  it("blocks a sister who named no wali — the case the live form accepts", () => {
    expect(profileMayGoLive("sister", [])).toEqual({ ok: false, reason: "no-guardianship" });
  });

  it("distinguishes an unanswered invitation from no invitation at all", () => {
    expect(profileMayGoLive("sister", [make()])).toEqual({
      ok: false,
      reason: "guardianship-not-confirmed",
    });
  });

  it("lets a sister through with a confirmed, verified wali", () => {
    expect(profileMayGoLive("sister", [confirmed()])).toEqual({ ok: true });
  });

  it("blocks an unverified wali by default (D10)", () => {
    const g = confirmed({ verification: { state: "unverified", verifiedAt: null, method: null } });
    expect(profileMayGoLive("sister", [g])).toEqual({ ok: false, reason: "wali-not-verified" });
  });

  it("allows an unverified wali only when verification is explicitly waived", () => {
    const g = confirmed({ verification: { state: "unverified", verifiedAt: null, method: null } });
    expect(profileMayGoLive("sister", [g], { requireVerifiedWali: false })).toEqual({ ok: true });
  });

  it("blocks rather than choosing when the one-wali invariant is broken", () => {
    expect(profileMayGoLive("sister", [confirmed({ id: "a" }), confirmed({ id: "b" })])).toEqual({
      ok: false,
      reason: "multiple-confirmed-guardianships",
    });
  });
});

describe("isActive", () => {
  it("is true only for confirmed", () => {
    for (const status of GUARDIANSHIP_STATES) {
      expect(isActive(confirmed({ status }))).toBe(status === "confirmed");
    }
  });
});
