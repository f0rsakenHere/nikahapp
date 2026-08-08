import { describe, expect, it } from "vitest";
import {
  LedgerEntrySchema,
  ConnectionRequestSchema,
  REQUEST_STATES,
  TERMINAL_REQUEST_STATES,
  appearsInBrowse,
  applyRequest,
  balanceOf,
  canSend,
  costOfSending,
  pairKey,
  reservedOf,
  type ConnectionRequest,
  type RequestEvent,
  type SendContext,
} from "./connection";
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from "./settings";

const NOW = new Date("2026-08-09T10:00:00Z");
const LATER = new Date("2026-09-01T10:00:00Z");

const settings = (over: Partial<Settings> = {}): Settings =>
  SettingsSchema.parse({ ...DEFAULT_SETTINGS, ...over });

function request(over: Partial<ConnectionRequest> = {}): ConnectionRequest {
  return ConnectionRequestSchema.parse({
    id: "r1",
    pairKey: pairKey("a", "b"),
    fromUserId: "a",
    toUserId: "b",
    state: "pending",
    sentAt: NOW,
    expiresAt: new Date(NOW.getTime() + 14 * 86_400_000),
    answeredAt: null,
    declineReason: null,
    conversationId: null,
    ...over,
  });
}

function ctx(over: Partial<SendContext> = {}): SendContext {
  return {
    balance: 10,
    recipientPending: 0,
    existingBetweenPair: null,
    senderVerified: true,
    recipientVerified: true,
    senderGender: "brother",
    blocked: false,
    ...over,
  };
}

/* ------------------------------------------------------------ ledger -- */

describe("the ledger", () => {
  it("sums to a balance", () => {
    expect(balanceOf([{ delta: 10 }, { delta: -1 }, { delta: -1 }, { delta: 1 }])).toBe(9);
  });

  it("reports what is held against requests in flight", () => {
    const entries = [
      { delta: 10, reason: "monthlyGrant" as const },
      { delta: -1, reason: "reservedForRequest" as const },
      { delta: -1, reason: "reservedForRequest" as const },
      { delta: 1, reason: "refundedOnDecline" as const },
    ];
    expect(reservedOf(entries)).toBe(2);
    expect(balanceOf(entries)).toBe(9);
  });

  it("refuses a staff adjustment with no explanation", () => {
    const bad = {
      userId: "u1",
      delta: 5,
      reason: "adjustedByStaff",
      requestId: null,
      at: NOW,
      byUserId: null,
      note: null,
    };
    expect(LedgerEntrySchema.safeParse(bad).success).toBe(false);

    const good = { ...bad, byUserId: "s1", note: "goodwill after a support call" };
    expect(LedgerEntrySchema.safeParse(good).success).toBe(true);
  });

  it("does not demand a note for an ordinary grant", () => {
    const grant = {
      userId: "u1",
      delta: 10,
      reason: "monthlyGrant",
      requestId: null,
      at: NOW,
      byUserId: null,
      note: null,
    };
    expect(LedgerEntrySchema.safeParse(grant).success).toBe(true);
  });
});

/* ------------------------------------------------------------ sending -- */

describe("canSend", () => {
  it("allows an ordinary request and charges one", () => {
    expect(canSend("a", "b", ctx(), settings())).toEqual({ ok: true, cost: 1 });
  });

  it("refuses asking yourself", () => {
    expect(canSend("a", "a", ctx(), settings())).toEqual({ ok: false, reason: "same-person" });
  });

  it("refuses when the sender has run out", () => {
    expect(canSend("a", "b", ctx({ balance: 0 }), settings())).toEqual({
      ok: false,
      reason: "no-connections-left",
    });
  });

  /* The mechanism that protects the receiving side. */
  it("refuses when the recipient's inbox is full", () => {
    const full = ctx({ recipientPending: 10 });
    expect(canSend("a", "b", full, settings())).toEqual({
      ok: false,
      reason: "recipient-inbox-full",
    });
  });

  it("checks the inbox before the balance, so a full inbox costs nothing to discover", () => {
    const both = ctx({ recipientPending: 10, balance: 0 });
    expect(canSend("a", "b", both, settings())).toEqual({
      ok: false,
      reason: "recipient-inbox-full",
    });
  });

  it("lets the cap be turned off", () => {
    const uncapped = settings({ inboundCap: null });
    expect(canSend("a", "b", ctx({ recipientPending: 500 }), uncapped).ok).toBe(true);
  });

  it("refuses a second request to the same person", () => {
    for (const state of ["pending", "accepted"] as const) {
      expect(canSend("a", "b", ctx({ existingBetweenPair: state }), settings())).toEqual({
        ok: false,
        reason: "already-asked",
      });
    }
  });

  it("refuses to re-ask after a decline, unless that is turned on", () => {
    const declined = ctx({ existingBetweenPair: "declined" });
    expect(canSend("a", "b", declined, settings())).toEqual({
      ok: false,
      reason: "already-answered-no",
    });
    expect(canSend("a", "b", declined, settings({ allowRetryAfterDecline: true })).ok).toBe(true);
  });

  it("never lets a blocked person through, even with retries allowed", () => {
    const blocked = ctx({ blocked: true });
    expect(canSend("a", "b", blocked, settings({ allowRetryAfterDecline: true }))).toEqual({
      ok: false,
      reason: "blocked",
    });
  });

  it("refuses both directions of unverified when verification is required", () => {
    expect(canSend("a", "b", ctx({ senderVerified: false }), settings())).toEqual({
      ok: false,
      reason: "not-verified",
    });
    expect(canSend("a", "b", ctx({ recipientVerified: false }), settings())).toEqual({
      ok: false,
      reason: "recipient-not-verified",
    });
  });

  it("lets an unverified pool browse when that is turned on", () => {
    const open = settings({ requireVerifiedToBrowse: false });
    expect(canSend("a", "b", ctx({ senderVerified: false, recipientVerified: false }), open).ok).toBe(
      true
    );
  });
});

describe("costOfSending", () => {
  it("charges one under reserve and onSend", () => {
    for (const charge of ["reserve", "onSend"] as const) {
      expect(costOfSending("brother", settings({ connectionCharge: charge }))).toBe(1);
    }
  });

  it("charges nothing up front when the charge falls on acceptance", () => {
    expect(costOfSending("brother", settings({ connectionCharge: "onAccept" }))).toBe(0);
  });

  it("charges only brothers when the cost is one-sided", () => {
    const oneSided = settings({ bothGendersSpend: false });
    expect(costOfSending("brother", oneSided)).toBe(1);
    expect(costOfSending("sister", oneSided)).toBe(0);
  });
});

/* -------------------------------------------------------- transitions -- */

describe("applyRequest", () => {
  const EVENTS: Record<RequestEvent["type"], RequestEvent> = {
    accept: { type: "accept", at: LATER },
    decline: { type: "decline", at: LATER },
    withdraw: { type: "withdraw", at: LATER },
    expire: { type: "expire", at: LATER },
    block: { type: "block", at: LATER },
  };

  it("moves a pending request to every terminal state", () => {
    expect(applyRequest(request(), EVENTS.accept, settings())).toMatchObject({
      ok: true,
      next: { state: "accepted" },
    });
    for (const type of ["decline", "withdraw", "expire", "block"] as const) {
      const result = applyRequest(request(), EVENTS[type], settings());
      expect(result.ok).toBe(true);
      if (result.ok) expect(TERMINAL_REQUEST_STATES.has(result.next.state)).toBe(true);
    }
  });

  it("refuses every event once a request is answered", () => {
    for (const state of REQUEST_STATES) {
      if (state === "pending") continue;
      const answered = request({ state, answeredAt: LATER });
      for (const type of Object.keys(EVENTS) as RequestEvent["type"][]) {
        const result = applyRequest(answered, EVENTS[type], settings());
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error).toBe("illegal-transition");
      }
    }
  });

  it("will not expire a request before its time", () => {
    const early = applyRequest(request(), { type: "expire", at: NOW }, settings());
    expect(!early.ok && early.error).toBe("not-yet-expired");
  });

  it("returns the connection on a decline, an expiry and a withdrawal", () => {
    for (const [type, reason] of [
      ["decline", "refundedOnDecline"],
      ["withdraw", "refundedOnDecline"],
      ["expire", "refundedOnExpiry"],
      ["block", "refundedOnDecline"],
    ] as const) {
      const result = applyRequest(request(), EVENTS[type], settings());
      expect(result.ok && result.ledger).toBe(reason);
    }
  });

  it("returns nothing when the charge was taken on sending", () => {
    const onSend = settings({ connectionCharge: "onSend" });
    for (const type of ["decline", "withdraw", "expire"] as const) {
      const result = applyRequest(request(), EVENTS[type], onSend);
      expect(result.ok && result.ledger).toBeNull();
    }
  });

  it("takes the connection on acceptance under reserve and onAccept", () => {
    for (const charge of ["reserve", "onAccept"] as const) {
      const result = applyRequest(request(), EVENTS.accept, settings({ connectionCharge: charge }));
      expect(result.ok && result.ledger).toBe("consumedOnAccept");
    }
  });

  it("does not charge twice when it was taken on sending", () => {
    const result = applyRequest(request(), EVENTS.accept, settings({ connectionCharge: "onSend" }));
    expect(result.ok && result.ledger).toBeNull();
  });

  it("does not mutate its input", () => {
    const r = request();
    applyRequest(r, EVENTS.accept, settings());
    expect(r.state).toBe("pending");
  });
});

describe("ConnectionRequestSchema", () => {
  it("refuses a request to yourself", () => {
    expect(ConnectionRequestSchema.safeParse({ ...request(), toUserId: "a" }).success).toBe(false);
  });

  it("refuses an answered request with no answer time", () => {
    const bad = { ...request(), state: "declined", answeredAt: null };
    expect(ConnectionRequestSchema.safeParse(bad).success).toBe(false);
  });
});

/* ------------------------------------------------------------ browse -- */

describe("appearsInBrowse", () => {
  const member = { verified: true, pendingInbound: 0, status: "live" };

  it("shows a live, verified member with room in their inbox", () => {
    expect(appearsInBrowse(member, settings())).toBe(true);
  });

  it("hides anyone whose profile is not live", () => {
    for (const status of ["draft", "pendingReview", "paused", "withdrawn"]) {
      expect(appearsInBrowse({ ...member, status }, settings())).toBe(false);
    }
  });

  it("hides an unverified member when verification is required", () => {
    expect(appearsInBrowse({ ...member, verified: false }, settings())).toBe(false);
    expect(
      appearsInBrowse({ ...member, verified: false }, settings({ requireVerifiedToBrowse: false }))
    ).toBe(true);
  });

  /* The whole point of the cap: demand spreads instead of piling onto
     the same few profiles. */
  it("hides someone whose inbox is full, and shows them again when it is not", () => {
    expect(appearsInBrowse({ ...member, pendingInbound: 10 }, settings())).toBe(false);
    expect(appearsInBrowse({ ...member, pendingInbound: 9 }, settings())).toBe(true);
  });
});
