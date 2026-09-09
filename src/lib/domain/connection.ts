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
import { inPool } from "./profile";
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
  /** How many asks this person has sent in the last seven days.
   *
   *  A rate, not a wallet. Under the plan model asking is free, so
   *  nothing is spent, held or refunded — what stops one member working
   *  through the whole pool in an afternoon is how often they may ask,
   *  and that is answered by counting requests rather than by keeping a
   *  balance somebody has to be granted. */
  asksThisWeek: number;
  /** Requests the recipient already has waiting. */
  recipientPending: number;
  /** A live request between these two, in either direction. */
  existingBetweenPair: RequestState | null;
  /** Both sides are in the pool — see `inPool`. Named for what it
   *  actually decides: under deferred approval a member is in the pool
   *  without yet being verified, and calling that "verified" is how the
   *  check ends up in the wrong place. */
  senderInPool: boolean;
  recipientInPool: boolean;
  senderGender: "brother" | "sister";
  blocked: boolean;
};

export type SendRefusal =
  | "weekly-asks-spent"
  | "recipient-inbox-full"
  | "already-asked"
  | "already-answered-no"
  | "awaiting-your-answer"
  | "not-verified"
  | "recipient-not-verified"
  | "blocked"
  | "same-person";

export type SendDecision = { ok: true } | { ok: false; reason: SendRefusal };

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

  /* Unconditional, and it did not used to be. Both checks sat behind
     `requireVerifiedToBrowse`, so turning that off removed the only
     thing standing between a half-filled draft and the ask button —
     nothing else on this path looks at the sender's status at all.
     What the setting decides is who counts as being in the pool; that
     somebody must be *in* it to ask is not a setting. */
  if (!ctx.senderInPool) return { ok: false, reason: "not-verified" };
  if (!ctx.recipientInPool) return { ok: false, reason: "recipient-not-verified" };

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

  /* The weekly cap, and it applies to everybody.
   *
   *  It is spam control, not billing: what a plan buys is the ability to
   *  talk, so a sister — who pays nothing — is still limited in how many
   *  people she may approach. Making the cap follow payment would mean
   *  the only unlimited asker is the one who has already been charged,
   *  which is precisely backwards. */
  if (ctx.asksThisWeek >= settings.asksPerWeek) {
    return { ok: false, reason: "weekly-asks-spent" };
  }

  return { ok: true };
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
  | { ok: true; next: ConnectionRequest }
  | { ok: false; error: RequestError };

/** `(request, event) → request | error`.
 *
 *  It used to also return what the ledger should record, because an ask
 *  cost a connection and every answer either spent or returned it. Under
 *  the plan model asking is free, so acceptance, decline, withdrawal and
 *  expiry are all just state — there is no money in this function any
 *  more, and `settings` is no longer one of its arguments.
 */
export function applyRequest(request: ConnectionRequest, event: RequestEvent): RequestResult {
  if (request.state !== "pending") return { ok: false, error: "illegal-transition" };

  switch (event.type) {
    case "accept":
      return { ok: true, next: { ...request, state: "accepted", answeredAt: event.at } };

    case "decline":
      return {
        ok: true,
        next: {
          ...request,
          state: "declined",
          answeredAt: event.at,
          declineReason: event.reason ?? null,
        },
      };

    case "block":
      return { ok: true, next: { ...request, state: "blocked", answeredAt: event.at } };

    case "withdraw":
      return { ok: true, next: { ...request, state: "withdrawn", answeredAt: event.at } };

    case "expire":
      if (event.at < request.expiresAt) return { ok: false, error: "not-yet-expired" };
      return { ok: true, next: { ...request, state: "expired", answeredAt: event.at } };
  }
}

/** Whether a member should still appear in browse.
 *
 *  Being at the cap hides them, which is the mechanism: demand spreads
 *  to everyone else instead of piling further onto the same few. */
export function appearsInBrowse(
  member: { pendingInbound: number; status: string },
  settings: Settings
): boolean {
  /* Which statuses count is D1f's business, not this function's. The
     `verified` flag that used to sit here was passed as a literal `true`
     by its only caller, so it decided nothing while reading as though
     it did. */
  if (!inPool(member.status, settings)) return false;
  if (settings.inboundCap !== null && member.pendingInbound >= settings.inboundCap) return false;
  return true;
}
