import { describe, expect, it } from "vitest";
import {
  CLOSED_STATES,
  CONVERSATION_STATES,
  ConversationSchema,
  MessageSchema,
  applyConversation,
  canRead,
  canSendMessage,
  closeStateFor,
  participant,
  type Conversation,
  type ConversationState,
} from "./conversation";

const NOW = new Date("2026-08-09T10:00:00Z");
const LATER = new Date("2026-08-09T12:00:00Z");

const HIM = "him";
const HER = "her";
const WALI = "wali";
const STAFF = "staff";

function conversation(over: Partial<Conversation> = {}): Conversation {
  return ConversationSchema.parse({
    id: "c1",
    requestId: "r1",
    participants: [
      { userId: HIM, role: "member", canWrite: true },
      { userId: HER, role: "member", canWrite: true },
      { userId: WALI, role: "wali", canWrite: false },
    ],
    state: "open",
    openedAt: NOW,
    lastMessageAt: null,
    messageCount: 0,
    closedAt: null,
    closedBy: null,
    closeReason: null,
    createdAt: NOW,
    ...over,
  });
}

describe("ConversationSchema", () => {
  it("accepts two members and a wali", () => {
    expect(ConversationSchema.safeParse(conversation()).success).toBe(true);
  });

  it("refuses anything but exactly two members", () => {
    const one = {
      ...conversation(),
      participants: [
        { userId: HIM, role: "member", canWrite: true },
        { userId: WALI, role: "wali", canWrite: false },
      ],
    };
    expect(ConversationSchema.safeParse(one).success).toBe(false);
  });

  /* A man reading a thread he is also in is not oversight. */
  it("refuses the same person holding two seats", () => {
    const doubled = {
      ...conversation(),
      participants: [
        { userId: HIM, role: "member", canWrite: true },
        { userId: HER, role: "member", canWrite: true },
        { userId: HIM, role: "wali", canWrite: false },
      ],
    };
    expect(ConversationSchema.safeParse(doubled).success).toBe(false);
  });

  it("makes an open conversation with no opening time unrepresentable", () => {
    expect(
      ConversationSchema.safeParse({ ...conversation(), openedAt: null }).success
    ).toBe(false);
  });

  it("makes a closed conversation with no closing time unrepresentable", () => {
    for (const state of CLOSED_STATES) {
      const bad = { ...conversation(), state, closedAt: null };
      expect(ConversationSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("MessageSchema", () => {
  const message = {
    id: "m1",
    conversationId: "c1",
    fromUserId: HIM,
    kind: "member",
    body: "Assalamu alaikum.",
    sentAt: NOW,
  };

  it("accepts a member message and a system one", () => {
    expect(MessageSchema.safeParse(message).success).toBe(true);
    expect(
      MessageSchema.safeParse({ ...message, kind: "system", fromUserId: null }).success
    ).toBe(true);
  });

  it("refuses a member message with no author", () => {
    expect(MessageSchema.safeParse({ ...message, fromUserId: null }).success).toBe(false);
  });

  it("refuses a system message attributed to somebody", () => {
    expect(MessageSchema.safeParse({ ...message, kind: "system" }).success).toBe(false);
  });

  it("refuses an empty message", () => {
    expect(MessageSchema.safeParse({ ...message, body: "" }).success).toBe(false);
  });

  /* "Messages cannot be edited or deleted once sent, by anyone" is
     published. The schema has nowhere to record an edit. */
  it("has no field in which an edit could be recorded", () => {
    const parsed = MessageSchema.parse(message);
    expect(Object.keys(parsed)).toEqual([
      "id",
      "conversationId",
      "fromUserId",
      "kind",
      "body",
      "sentAt",
    ]);
  });
});

describe("canRead", () => {
  const c = conversation();

  it("lets the two members and the wali read", () => {
    for (const who of [HIM, HER, WALI]) {
      expect(canRead(c, { userId: who, isStaff: false })).toBe(true);
    }
  });

  it("lets staff read, because oversight is a published power", () => {
    expect(canRead(c, { userId: STAFF, isStaff: true })).toBe(true);
  });

  /* §7.2 calls this the catastrophic case. */
  it("refuses another family's wali", () => {
    expect(canRead(c, { userId: "another-wali", isStaff: false })).toBe(false);
  });

  it("refuses a stranger", () => {
    expect(canRead(c, { userId: "nobody", isStaff: false })).toBe(false);
  });
});

describe("canSendMessage", () => {
  const c = conversation();

  it("lets a member write in an open thread", () => {
    expect(canSendMessage(c, { userId: HIM, isStaff: false }, "hello")).toEqual({ ok: true });
  });

  it("refuses the wali when he is read-only", () => {
    expect(canSendMessage(c, { userId: WALI, isStaff: false }, "hello")).toEqual({
      ok: false,
      reason: "read-only",
    });
  });

  it("lets him write when that is turned on (D6)", () => {
    const writable = conversation({
      participants: [
        { userId: HIM, role: "member", canWrite: true },
        { userId: HER, role: "member", canWrite: true },
        { userId: WALI, role: "wali", canWrite: true },
      ],
    });
    expect(canSendMessage(writable, { userId: WALI, isStaff: false }, "hello").ok).toBe(true);
  });

  /* An oversight reader who can post is indistinguishable from a member. */
  it("never lets staff write, however senior", () => {
    expect(canSendMessage(c, { userId: STAFF, isStaff: true }, "hello")).toEqual({
      ok: false,
      reason: "not-a-participant",
    });
  });

  it("refuses before approval and after closing", () => {
    for (const state of ["awaitingWali", ...CLOSED_STATES] as ConversationState[]) {
      const other = conversation({
        state,
        openedAt: state === "awaitingWali" ? null : NOW,
        closedAt: CLOSED_STATES.has(state) ? LATER : null,
      });
      expect(canSendMessage(other, { userId: HIM, isStaff: false }, "hello")).toEqual({
        ok: false,
        reason: "not-open",
      });
    }
  });

  it("refuses whitespace", () => {
    expect(canSendMessage(c, { userId: HIM, isStaff: false }, "   ")).toEqual({
      ok: false,
      reason: "empty",
    });
  });
});

describe("closeStateFor", () => {
  const c = conversation();

  it("records who ended it", () => {
    expect(closeStateFor(c, { userId: HIM, isStaff: false })).toBe("closedByMember");
    expect(closeStateFor(c, { userId: WALI, isStaff: false })).toBe("closedByWali");
    expect(closeStateFor(c, { userId: STAFF, isStaff: true })).toBe("closedByStaff");
  });

  it("refuses a stranger", () => {
    expect(closeStateFor(c, { userId: "nobody", isStaff: false })).toBeNull();
  });

  it("refuses to close something already closed", () => {
    const closed = conversation({ state: "closedByWali", closedAt: LATER, closedBy: WALI });
    expect(closeStateFor(closed, { userId: HIM, isStaff: false })).toBeNull();
  });
});

describe("applyConversation", () => {
  const waiting = conversation({ state: "awaitingWali", openedAt: null });

  it("opens on approval, and says so in the thread", () => {
    const result = applyConversation(
      waiting,
      { type: "waliApproves", at: LATER, waliUserId: WALI },
      "Ahmed Al-Rashid"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.state).toBe("open");
    expect(result.next.openedAt).toEqual(LATER);
    expect(result.systemMessage).toContain("Ahmed Al-Rashid");
    expect(ConversationSchema.safeParse(result.next).success).toBe(true);
  });

  it("closes on his refusal, attributed to him", () => {
    const result = applyConversation(
      waiting,
      { type: "waliDeclines", at: LATER, waliUserId: WALI, reason: "not suitable" },
      "Ahmed"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.state).toBe("closedByWali");
    expect(result.next.closedBy).toBe(WALI);
  });

  /* The gate is the product. A member approving her own conversation
     would be the whole promise undone. */
  it("refuses approval from anybody who is not the wali", () => {
    for (const who of [HIM, HER, "another-wali"]) {
      const result = applyConversation(
        waiting,
        { type: "waliApproves", at: LATER, waliUserId: who },
        "Ahmed"
      );
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toBe("not-the-wali");
    }
  });

  it("refuses approval once it is already open", () => {
    const result = applyConversation(
      conversation(),
      { type: "waliApproves", at: LATER, waliUserId: WALI },
      "Ahmed"
    );
    expect(!result.ok && result.error).toBe("illegal-transition");
  });

  it("lets any of the three close an open thread", () => {
    for (const [who, isStaff, expected] of [
      [HIM, false, "closedByMember"],
      [WALI, false, "closedByWali"],
      [STAFF, true, "closedByStaff"],
    ] as const) {
      const result = applyConversation(
        conversation(),
        { type: "close", at: LATER, by: who, isStaff, reason: "enough" },
        "Ahmed"
      );
      expect(result.ok && result.next.state).toBe(expected);
    }
  });

  it("refuses to close a closed thread", () => {
    const closed = conversation({ state: "completed", closedAt: LATER, closedBy: STAFF });
    const result = applyConversation(
      closed,
      { type: "close", at: LATER, by: HIM, isStaff: false },
      "Ahmed"
    );
    expect(!result.ok && result.error).toBe("already-closed");
  });

  it("does not mutate its input", () => {
    const c = conversation();
    applyConversation(c, { type: "close", at: LATER, by: HIM, isStaff: false }, "Ahmed");
    expect(c.state).toBe("open");
  });

  it("covers every state in the union", () => {
    /* If a state is added without deciding how it closes or opens, this
       is where it shows up. */
    for (const state of CONVERSATION_STATES) {
      expect(typeof state).toBe("string");
    }
    expect(CONVERSATION_STATES).toHaveLength(6);
  });
});

describe("participant", () => {
  it("finds a seat and reports its role", () => {
    expect(participant(conversation(), WALI)?.role).toBe("wali");
    expect(participant(conversation(), "nobody")).toBeNull();
  });
});
