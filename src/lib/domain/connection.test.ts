import { describe, expect, it } from "vitest";
import {
  ConnectionRequestSchema,
  REQUEST_STATES,
  TERMINAL_REQUEST_STATES,
  appearsInBrowse,
  applyRequest,
  canSend,
  pairKey,
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
    asksThisWeek: 0,
    recipientPending: 0,
    existingBetweenPair: null,
    senderInPool: true,
    recipientInPool: true,
    senderGender: "brother",
    blocked: false,
    ...over,
  };
}

/* ------------------------------------------------------------ sending -- */

describe("canSend", () => {
  it("allows an ordinary request, and it costs nothing", () => {
    expect(canSend("a", "b", ctx(), settings())).toEqual({ ok: true });
  });

  it("refuses asking yourself", () => {
    expect(canSend("a", "a", ctx(), settings())).toEqual({ ok: false, reason: "same-person" });
  });

  it("refuses once the week's asks are used up", () => {
    const spent = ctx({ asksThisWeek: DEFAULT_SETTINGS.asksPerWeek });
    expect(canSend("a", "b", spent, settings())).toEqual({
      ok: false,
      reason: "weekly-asks-spent",
    });
  });

  it("caps the side that pays nothing too", () => {
    /* The cap is spam control, not billing. A sister pays for no part of
       this and is still limited in how many people she may approach. */
    const her = ctx({ senderGender: "sister", asksThisWeek: DEFAULT_SETTINGS.asksPerWeek });
    expect(canSend("a", "b", her, settings())).toEqual({
      ok: false,
      reason: "weekly-asks-spent",
    });
  });

  it("allows the last ask of the week", () => {
    const nearly = ctx({ asksThisWeek: DEFAULT_SETTINGS.asksPerWeek - 1 });
    expect(canSend("a", "b", nearly, settings())).toEqual({ ok: true });
  });

  /* The mechanism that protects the receiving side. */
  it("refuses when the recipient's inbox is full", () => {
    const full = ctx({ recipientPending: 10 });
    expect(canSend("a", "b", full, settings())).toEqual({
      ok: false,
      reason: "recipient-inbox-full",
    });
  });

  it("checks the inbox before the weekly cap, so the kinder refusal wins", () => {
    const both = ctx({ recipientPending: 10, asksThisWeek: 99 });
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

  it("refuses both directions when either is outside the pool", () => {
    expect(canSend("a", "b", ctx({ senderInPool: false }), settings())).toEqual({
      ok: false,
      reason: "not-verified",
    });
    expect(canSend("a", "b", ctx({ recipientInPool: false }), settings())).toEqual({
      ok: false,
      reason: "recipient-not-verified",
    });
  });

  /* The regression this pair exists for: both checks used to sit behind
     `requireVerifiedToBrowse`, so deferring approval did not widen who
     was in the pool — it removed the question. A draft could ask. */
  it("still refuses somebody outside the pool when approval is deferred", () => {
    const open = settings({ requireVerifiedToBrowse: false });
    expect(canSend("a", "b", ctx({ senderInPool: false }), open)).toEqual({
      ok: false,
      reason: "not-verified",
    });
    expect(canSend("a", "b", ctx({ recipientInPool: false }), open)).toEqual({
      ok: false,
      reason: "recipient-not-verified",
    });
    expect(canSend("a", "b", ctx(), open).ok).toBe(true);
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
    expect(applyRequest(request(), EVENTS.accept)).toMatchObject({
      ok: true,
      next: { state: "accepted" },
    });
    for (const type of ["decline", "withdraw", "expire", "block"] as const) {
      const result = applyRequest(request(), EVENTS[type]);
      expect(result.ok).toBe(true);
      if (result.ok) expect(TERMINAL_REQUEST_STATES.has(result.next.state)).toBe(true);
    }
  });

  it("refuses every event once a request is answered", () => {
    for (const state of REQUEST_STATES) {
      if (state === "pending") continue;
      const answered = request({ state, answeredAt: LATER });
      for (const type of Object.keys(EVENTS) as RequestEvent["type"][]) {
        const result = applyRequest(answered, EVENTS[type]);
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error).toBe("illegal-transition");
      }
    }
  });

  it("will not expire a request before its time", () => {
    const early = applyRequest(request(), { type: "expire", at: NOW });
    expect(!early.ok && early.error).toBe("not-yet-expired");
  });

  it("carries no money in it any more", () => {
    /* Every answer used to return a ledger reason: a decline gave the
       held connection back, an acceptance took it. Asking is free now,
       so the four answers differ only in the state they land on, and
       there is nothing here for a wallet to react to. */
    for (const type of ["decline", "withdraw", "expire", "block", "accept"] as const) {
      const result = applyRequest(request(), EVENTS[type]);
      expect(result.ok).toBe(true);
      expect(result.ok && "ledger" in result).toBe(false);
    }
  });

  it("does not mutate its input", () => {
    const r = request();
    applyRequest(r, EVENTS.accept);
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
  const member = { pendingInbound: 0, status: "live" };
  /* Both spelled out rather than leaning on the default, which is the
     product's current stance and not a fact these rules should be read
     through — the whole point of the pair is that either may be set. */
  const gated = settings({ requireVerifiedToBrowse: true });
  const open = settings({ requireVerifiedToBrowse: false });

  it("shows a live member with room in their inbox", () => {
    expect(appearsInBrowse(member, gated)).toBe(true);
    expect(appearsInBrowse(member, open)).toBe(true);
  });

  it("hides anyone not approved while approval is the gate", () => {
    for (const status of ["draft", "pendingReview", "verifying", "paused", "withdrawn"]) {
      expect(appearsInBrowse({ ...member, status }, gated)).toBe(false);
    }
  });

  it("shows a submitted profile once approval is deferred", () => {
    for (const status of ["pendingCall", "pendingReview", "verifying", "live"]) {
      expect(appearsInBrowse({ ...member, status }, open)).toBe(true);
    }
  });

  /* Deferring approval widens the pool to people who have finished and
     sent their profile in. It does not open it to a half-filled draft,
     to somebody who paused themselves, or to anyone who has left. */
  it("still hides a draft and anyone who has left, approval deferred or not", () => {
    for (const status of ["draft", "paused", "matched", "withdrawn", "rejected"]) {
      expect(appearsInBrowse({ ...member, status }, open)).toBe(false);
    }
  });

  /* The whole point of the cap: demand spreads instead of piling onto
     the same few profiles. */
  it("hides someone whose inbox is full, and shows them again when it is not", () => {
    expect(appearsInBrowse({ ...member, pendingInbound: 10 }, settings())).toBe(false);
    expect(appearsInBrowse({ ...member, pendingInbound: 9 }, settings())).toBe(true);
  });
});
