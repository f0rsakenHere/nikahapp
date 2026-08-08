/* Connections: the balance, and the request to talk.
 *
 * The model the client described — both genders browse, asking to talk
 * spends a connection, and on acceptance the flow rejoins the published
 * process (wali, conversation, fee, contact last).
 *
 * Two pieces, deliberately separate:
 *
 *   the ledger    where connections come from and go. Entries, never a
 *                 counter — see below.
 *   the request   one person asking another, and its states.
 *
 * Pure. Every setting that could differ is passed in (see settings.ts),
 * so the client's answers change a value rather than this file.
 */
import { z } from "zod";
import type { Settings } from "./settings";

/* ---------------------------------------------------------- ledger --- */

/* Entries rather than `user.connections: 7`.
 *
 * A counter cannot answer "where did my ten go", which is the first
 * question anyone asks, and it drifts the moment a refund and a purchase
 * race each other. It also makes a dispute unanswerable: there is
 * nothing to show the member. The balance is the sum, cached where a
 * query needs it. */
export const LEDGER_REASONS = [
  "monthlyGrant",
  "purchase",
  "reservedForRequest",
  "consumedOnAccept",
  "refundedOnDecline",
  "refundedOnExpiry",
  "refundedByStaff",
  "adjustedByStaff",
] as const;

export type LedgerReason = (typeof LEDGER_REASONS)[number];

export const LedgerEntrySchema = z.object({
  userId: z.string().min(1),
  /* Negative spends, positive grants and refunds. */
  delta: z.number().int(),
  reason: z.enum(LEDGER_REASONS),
  /* The request this entry is about, when it is about one. It is what
   * makes "reserved, then refunded" readable as one story rather than
   * two unrelated numbers. */
  requestId: z.string().min(1).nullable(),
  at: z.date(),
  /* Set only by `adjustedByStaff` and `refundedByStaff`, and required
   * there: an adjustment nobody can explain is indistinguishable from a
   * bug in the ledger. */
  byUserId: z.string().min(1).nullable(),
  note: z.string().max(500).nullable(),
})
  .refine(
    (e) =>
      !["adjustedByStaff", "refundedByStaff"].includes(e.reason) ||
      (e.byUserId !== null && (e.note ?? "").trim().length > 0),
    { message: "a staff adjustment must record who made it and why", path: ["note"] }
  );

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export function balanceOf(entries: readonly Pick<LedgerEntry, "delta">[]): number {
  return entries.reduce((total, e) => total + e.delta, 0);
}

/** What is held against requests still in flight, as a positive number. */
export function reservedOf(entries: readonly Pick<LedgerEntry, "delta" | "reason">[]): number {
  return entries
    .filter((e) => e.reason === "reservedForRequest")
    .reduce((total, e) => total - e.delta, 0);
}

/* --------------------------------------------------------- request --- */

export const REQUEST_STATES = [
  "pending", //   sent, not yet answered
  "accepted", //  she said yes; the wali gate comes next
  "declined", //  she said no
  "expired", //   nobody answered in time
  "withdrawn", // he changed his mind
  "blocked", //   she blocked him; different from a decline on purpose
] as const;

export type RequestState = (typeof REQUEST_STATES)[number];

export const TERMINAL_REQUEST_STATES: ReadonlySet<RequestState> = new Set([
  "declined",
  "expired",
  "withdrawn",
  "blocked",
]);

export const ConnectionRequestSchema = z.object({
  id: z.string().min(1),
  /* "<fromUserId>:<toUserId>", unique. The same pair is never asked
   * twice concurrently, and §5.5's `pairKey` index carries over. */
  pairKey: z.string().min(3),
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  state: z.enum(REQUEST_STATES),
  sentAt: z.date(),
  expiresAt: z.date(),
  answeredAt: z.date().nullable(),
  /* Kept even when it is not disclosed, because staff need it for the
   * safety queue even where she is not shown it. */
  declineReason: z.string().max(500).nullable(),
  conversationId: z.string().min(1).nullable(),
})
  .refine((r) => r.fromUserId !== r.toUserId, {
    message: "nobody may ask themselves",
    path: ["toUserId"],
  })
  .refine((r) => r.state === "pending" || r.answeredAt !== null, {
    message: "an answered request must record when",
    path: ["answeredAt"],
  });

export type ConnectionRequest = z.infer<typeof ConnectionRequestSchema>;

export function pairKey(fromUserId: string, toUserId: string): string {
  return `${fromUserId}:${toUserId}`;
}

/* ----------------------------------------------------------- send ---- */

export type SendContext = {
  balance: number;
  /** Requests the recipient already has waiting. */
  recipientPending: number;
  /** A live request between these two, in either direction. */
  existingBetweenPair: RequestState | null;
  senderVerified: boolean;
  recipientVerified: boolean;
  senderGender: "brother" | "sister";
  blocked: boolean;
};

export type SendRefusal =
  | "no-connections-left"
  | "recipient-inbox-full"
  | "already-asked"
  | "already-answered-no"
  | "awaiting-your-answer"
  | "not-verified"
  | "recipient-not-verified"
  | "blocked"
  | "same-person";

export type SendDecision = { ok: true; cost: number } | { ok: false; reason: SendRefusal };

/** Whether this request may be sent, and what it costs.
 *
 *  Every refusal is named rather than collapsed into a boolean, because
 *  each one needs a different sentence on screen — "she is not taking
 *  new requests at the moment" and "you have run out" are not the same
 *  disappointment. */
export function canSend(
  from: string,
  to: string,
  ctx: SendContext,
  settings: Settings
): SendDecision {
  if (from === to) return { ok: false, reason: "same-person" };
  if (ctx.blocked) return { ok: false, reason: "blocked" };

  if (settings.requireVerifiedToBrowse) {
    if (!ctx.senderVerified) return { ok: false, reason: "not-verified" };
    if (!ctx.recipientVerified) return { ok: false, reason: "recipient-not-verified" };
  }

  if (ctx.existingBetweenPair === "pending") {
    /* Both directions matter: if she has already asked him, the answer
     * is to answer her, not to open a second thread about it. */
    return { ok: false, reason: "already-asked" };
  }
  if (ctx.existingBetweenPair === "accepted") {
    return { ok: false, reason: "already-asked" };
  }
  if (
    (ctx.existingBetweenPair === "declined" || ctx.existingBetweenPair === "blocked") &&
    !settings.allowRetryAfterDecline
  ) {
    return { ok: false, reason: "already-answered-no" };
  }

  /* The cap protects the recipient, and it is checked before the
   * sender's balance so that a full inbox never costs anybody a
   * connection to discover. */
  if (settings.inboundCap !== null && ctx.recipientPending >= settings.inboundCap) {
    return { ok: false, reason: "recipient-inbox-full" };
  }

  const cost = costOfSending(ctx.senderGender, settings);
  if (cost > 0 && ctx.balance < cost) return { ok: false, reason: "no-connections-left" };

  return { ok: true, cost };
}

/** What sending costs this person. Zero when their gender does not pay
 *  (D1c) or when the charge falls on acceptance instead. */
export function costOfSending(
  gender: "brother" | "sister",
  settings: Settings
): number {
  if (!settings.bothGendersSpend && gender === "sister") return 0;
  return settings.connectionCharge === "onAccept" ? 0 : 1;
}

/* ------------------------------------------------------ transitions -- */

export type RequestEvent =
  | { type: "accept"; at: Date }
  | { type: "decline"; at: Date; reason?: string }
  | { type: "withdraw"; at: Date }
  | { type: "expire"; at: Date }
  | { type: "block"; at: Date };

export type RequestError = "illegal-transition" | "not-yet-expired";

export type RequestResult =
  | { ok: true; next: ConnectionRequest; ledger: LedgerReason | null }
  | { ok: false; error: RequestError };

/** `(request, event, settings) → request | error`, plus what the ledger
 *  should record.
 *
 *  Returning the ledger reason rather than writing it keeps this pure
 *  and keeps the two decisions — what happened, and what it costs —
 *  visible in one place. */
export function applyRequest(
  request: ConnectionRequest,
  event: RequestEvent,
  settings: Settings
): RequestResult {
  if (request.state !== "pending") return { ok: false, error: "illegal-transition" };

  const refundable = settings.connectionCharge === "reserve";

  switch (event.type) {
    case "accept":
      return {
        ok: true,
        next: { ...request, state: "accepted", answeredAt: event.at },
        /* Under `reserve` the held connection is now spent; under
         * `onSend` it already was; under `onAccept` this is the moment
         * it is taken. */
        ledger:
          settings.connectionCharge === "onSend" ? null : "consumedOnAccept",
      };

    case "decline":
      return {
        ok: true,
        next: {
          ...request,
          state: "declined",
          answeredAt: event.at,
          declineReason: event.reason ?? null,
        },
        ledger: refundable ? "refundedOnDecline" : null,
      };

    case "block":
      return {
        ok: true,
        next: { ...request, state: "blocked", answeredAt: event.at },
        /* Refunded like a decline. Being blocked is a consequence for
         * him; charging for it as well would make reporting somebody
         * feel like a favour to the platform. */
        ledger: refundable ? "refundedOnDecline" : null,
      };

    case "withdraw":
      return {
        ok: true,
        next: { ...request, state: "withdrawn", answeredAt: event.at },
        ledger: refundable ? "refundedOnDecline" : null,
      };

    case "expire":
      if (event.at < request.expiresAt) return { ok: false, error: "not-yet-expired" };
      return {
        ok: true,
        next: { ...request, state: "expired", answeredAt: event.at },
        ledger: refundable ? "refundedOnExpiry" : null,
      };
  }
}

/** Whether a member should still appear in browse.
 *
 *  Being at the cap hides them, which is the mechanism: demand spreads
 *  to everyone else instead of piling further onto the same few. */
export function appearsInBrowse(
  member: { verified: boolean; pendingInbound: number; status: string },
  settings: Settings
): boolean {
  if (member.status !== "live") return false;
  if (settings.requireVerifiedToBrowse && !member.verified) return false;
  if (settings.inboundCap !== null && member.pendingInbound >= settings.inboundCap) return false;
  return true;
}
