/* The conversation, and the guardian in it.
 *
 * docs/APP-PLAN.md §5.6 and §5.7. This is the part of the product that
 * has no equivalent elsewhere: a private thread between two people that
 * a third reads in full, by design, with everyone knowing it.
 *
 * Three rules carry the weight, and all three are enforced here rather
 * than by convention:
 *
 *   1. No thread exists without the wali's approval (when the gate is
 *      on). Not "is hidden until" — does not exist.
 *   2. Messages cannot be edited or deleted once sent, by anyone. The
 *      /how-it-works page says so in those words.
 *   3. The wali reads everything, and the banner naming him cannot be
 *      dismissed. He is a participant, and the interface never lets
 *      either member forget it.
 *
 * Pure. `now` is passed in.
 */
import { z } from "zod";

export const CONVERSATION_STATES = [
  "awaitingWali",
  "open",
  "closedByMember",
  "closedByWali",
  "closedByStaff",
  "completed",
] as const;

export type ConversationState = (typeof CONVERSATION_STATES)[number];

export const CLOSED_STATES: ReadonlySet<ConversationState> = new Set([
  "closedByMember",
  "closedByWali",
  "closedByStaff",
  "completed",
]);

export const ParticipantSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["member", "wali"]),
  /* D6 — "can the wali write, or only read?" The published copy calls
   * him "a participant rather than a bystander", and the banner says he
   * "can read every message". Those are compatible with either answer,
   * so it is a field rather than an assumption, defaulted by settings. */
  canWrite: z.boolean(),
});

export type Participant = z.infer<typeof ParticipantSchema>;

export const ConversationSchema = z
  .object({
    id: z.string().min(1),
    requestId: z.string().min(1),
    participants: z.array(ParticipantSchema).min(2).max(3),
    state: z.enum(CONVERSATION_STATES),
    openedAt: z.date().nullable(),
    lastMessageAt: z.date().nullable(),
    messageCount: z.number().int().min(0),
    closedAt: z.date().nullable(),
    closedBy: z.string().nullable(),
    closeReason: z.string().max(1000).nullable(),
    createdAt: z.date(),
  })
  .refine((c) => c.participants.filter((p) => p.role === "member").length === 2, {
    message: "a conversation has exactly two members",
    path: ["participants"],
  })
  .refine((c) => c.state !== "open" || c.openedAt !== null, {
    message: "an open conversation records when it opened",
    path: ["openedAt"],
  })
  .refine((c) => !CLOSED_STATES.has(c.state) || c.closedAt !== null, {
    message: "a closed conversation records when it closed",
    path: ["closedAt"],
  })
  /* The two members must be different people, and the wali must be
   * neither of them. A man reading a thread he is also in is not
   * oversight. */
  .refine(
    (c) => new Set(c.participants.map((p) => p.userId)).size === c.participants.length,
    { message: "the same person cannot hold two seats", path: ["participants"] }
  );

export type Conversation = z.infer<typeof ConversationSchema>;

/* -------------------------------------------------------- messages --- */

export const MessageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  /* Null for a system message — "Ahmed approved this and joined". Those
   * are part of the record and are not attributable to a person. */
  fromUserId: z.string().min(1).nullable(),
  kind: z.enum(["member", "system"]),
  body: z.string().min(1).max(4000),
  sentAt: z.date(),
})
  .refine((m) => (m.kind === "system") === (m.fromUserId === null), {
    message: "a member message has an author and a system message does not",
    path: ["fromUserId"],
  });

export type Message = z.infer<typeof MessageSchema>;

/* No `editedAt`, no `deletedAt`, and no update or delete in the
 * repository. "Messages cannot be edited or deleted once sent, by
 * anyone" is published on /how-it-works, and the way to keep a promise
 * like that is to give the code no way to break it. */

/* ------------------------------------------------------ who may act -- */

export type ConversationActor = { userId: string; isStaff: boolean };

export function participant(c: Conversation, userId: string): Participant | null {
  return c.participants.find((p) => p.userId === userId) ?? null;
}

/** May this person read the thread?
 *
 *  Staff may, and every such read is audited (§7.7). Everybody else must
 *  hold a seat in this conversation — not a seat in some conversation. */
export function canRead(c: Conversation, actor: ConversationActor): boolean {
  if (actor.isStaff) return true;
  return participant(c, actor.userId) !== null;
}

export type SendRefusal =
  | "not-a-participant"
  | "not-open"
  | "read-only"
  | "empty";

export function canSendMessage(
  c: Conversation,
  actor: ConversationActor,
  body: string
): { ok: true } | { ok: false; reason: SendRefusal } {
  const seat = participant(c, actor.userId);
  /* Staff read; they do not speak. An oversight reader who can post is
   * indistinguishable from a member, and §7.8 is emphatic that staff
   * presence must always be visible as staff presence. */
  if (!seat) return { ok: false, reason: "not-a-participant" };
  if (c.state !== "open") return { ok: false, reason: "not-open" };
  if (!seat.canWrite) return { ok: false, reason: "read-only" };
  if (!body.trim()) return { ok: false, reason: "empty" };
  return { ok: true };
}

/** Who may end it, and how that is recorded. Any of the three, at any
 *  time, once it is open — §6.1's "closed: any member, the wali, or
 *  staff, allowed from conversationOpen onward". */
export function closeStateFor(
  c: Conversation,
  actor: ConversationActor
): ConversationState | null {
  if (CLOSED_STATES.has(c.state)) return null;
  if (actor.isStaff) return "closedByStaff";
  const seat = participant(c, actor.userId);
  if (!seat) return null;
  return seat.role === "wali" ? "closedByWali" : "closedByMember";
}

/* ------------------------------------------------------ transitions -- */

export type ConversationEvent =
  | { type: "waliApproves"; at: Date; waliUserId: string }
  | { type: "waliDeclines"; at: Date; waliUserId: string; reason?: string }
  | { type: "close"; at: Date; by: string; isStaff: boolean; reason?: string };

export type ConversationError =
  | "illegal-transition"
  | "not-the-wali"
  | "already-closed";

export type ConversationResult =
  | { ok: true; next: Conversation; systemMessage: string | null }
  | { ok: false; error: ConversationError };

export function applyConversation(
  c: Conversation,
  event: ConversationEvent,
  waliName: string
): ConversationResult {
  switch (event.type) {
    case "waliApproves":
    case "waliDeclines": {
      if (c.state !== "awaitingWali") return { ok: false, error: "illegal-transition" };
      const seat = participant(c, event.waliUserId);
      if (!seat || seat.role !== "wali") return { ok: false, error: "not-the-wali" };

      if (event.type === "waliDeclines") {
        return {
          ok: true,
          next: {
            ...c,
            state: "closedByWali",
            closedAt: event.at,
            closedBy: event.waliUserId,
            closeReason: event.reason ?? null,
          },
          systemMessage: null,
        };
      }

      return {
        ok: true,
        next: { ...c, state: "open", openedAt: event.at },
        /* Written into the thread rather than shown as chrome: it is
         * part of what was said, both members see the same words, and it
         * survives in the record. The mock-up promises exactly this. */
        /* His role, not just his name. Named alone he reads as a third
           person in the room — the one member who is not being
           introduced to anybody — and somebody looking at their own
           thread asked, reasonably, why they were talking to a man. */
        systemMessage: `${waliName}, the wali, approved this conversation and joined it.`,
      };
    }

    case "close": {
      const next = closeStateFor(c, { userId: event.by, isStaff: event.isStaff });
      if (!next) return { ok: false, error: CLOSED_STATES.has(c.state) ? "already-closed" : "illegal-transition" };
      return {
        ok: true,
        next: {
          ...c,
          state: next,
          closedAt: event.at,
          closedBy: event.by,
          closeReason: event.reason ?? null,
        },
        systemMessage: null,
      };
    }
  }
}
