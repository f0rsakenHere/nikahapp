/* The only module that reads or writes `conversations` and `messages`.
 *
 * There is no update and no delete for a message, and that is the
 * feature. "Messages cannot be edited or deleted once sent, by anyone"
 * is published on /how-it-works; the way to keep that promise is to give
 * the code no way to break it.
 */
import { ObjectId, type WithId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb, withTransaction } from "@/lib/db/client";
import { stripUndefined } from "@/lib/db/strip";
import {
  ConversationSchema,
  MessageSchema,
  applyConversation,
  type Conversation,
  type ConversationEvent,
  type ConversationResult,
  type Message,
  type Participant,
} from "@/lib/domain/conversation";

type ConversationDoc = Omit<Conversation, "id"> & { _id: ObjectId };
type MessageDoc = Omit<Message, "id"> & { _id: ObjectId };

function toDomain(doc: WithId<ConversationDoc>): Conversation {
  const { _id, ...rest } = doc;
  return ConversationSchema.parse({ ...rest, id: _id.toHexString() });
}

async function conversations() {
  return (await getDb()).collection<ConversationDoc>(COLLECTIONS.conversations);
}

async function messages() {
  return (await getDb()).collection<MessageDoc>(COLLECTIONS.messages);
}

export async function findConversationById(id: string): Promise<Conversation | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await (await conversations()).findOne({ _id: new ObjectId(id) });
  return doc ? toDomain(doc) : null;
}

export async function findConversationByRequest(requestId: string): Promise<Conversation | null> {
  const doc = await (await conversations()).findOne({ requestId });
  return doc ? toDomain(doc) : null;
}

/** Everything this person has a seat in, most recently active first. */
export async function listConversationsFor(userId: string): Promise<Conversation[]> {
  const docs = await (await conversations())
    .find({ "participants.userId": userId } as never, {
      sort: { lastMessageAt: -1, createdAt: -1 },
      limit: 50,
    })
    .toArray();
  return docs.map(toDomain);
}

/** Opens a thread when a request is accepted.
 *
 *  Created in whichever state the wali gate implies, rather than created
 *  open and hidden. A conversation that exists and is concealed is one
 *  bug away from being visible; a conversation in `awaitingWali` cannot
 *  be written to at all. */
export async function createConversation(
  input: {
    requestId: string;
    participants: Participant[];
    awaitingWali: boolean;
  },
  now: Date
): Promise<Conversation> {
  const _id = new ObjectId();
  const doc: ConversationDoc = {
    _id,
    requestId: input.requestId,
    participants: input.participants,
    state: input.awaitingWali ? "awaitingWali" : "open",
    openedAt: input.awaitingWali ? null : now,
    lastMessageAt: null,
    messageCount: 0,
    closedAt: null,
    closedBy: null,
    closeReason: null,
    createdAt: now,
  };
  await (await conversations()).insertOne(stripUndefined(doc));
  return toDomain(doc);
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const docs = await (await messages())
    .find({ conversationId }, { sort: { sentAt: 1 }, limit: 500 })
    .toArray();
  return docs.map(({ _id, ...rest }) => MessageSchema.parse({ ...rest, id: _id.toHexString() }));
}

/** Appends a message and moves the conversation's counters with it.
 *
 *  One transaction, because a message whose conversation still says zero
 *  is a thread that looks empty in every list while containing
 *  something somebody said. */
export async function appendMessage(
  conversationId: string,
  message: { fromUserId: string | null; kind: "member" | "system"; body: string },
  now: Date
): Promise<Message> {
  const _id = new ObjectId();
  const doc: MessageDoc = {
    _id,
    conversationId,
    fromUserId: message.fromUserId,
    kind: message.kind,
    body: message.body.trim(),
    sentAt: now,
  };

  await withTransaction(async (session) => {
    const db = await getDb();
    await db.collection<MessageDoc>(COLLECTIONS.messages).insertOne(doc, { session });
    await db
      .collection<ConversationDoc>(COLLECTIONS.conversations)
      .updateOne(
        { _id: new ObjectId(conversationId) },
        { $set: { lastMessageAt: now }, $inc: { messageCount: 1 } },
        { session }
      );
  });

  return MessageSchema.parse({ ...doc, id: _id.toHexString() });
}

/** Applies a domain event, and writes the system message it produces.
 *
 *  The state change and the line in the thread go together: an approval
 *  that opened the conversation without saying so would leave both
 *  members looking at a thread that became writable for no visible
 *  reason. */
export async function applyToConversation(
  conversation: Conversation,
  event: ConversationEvent,
  waliName: string,
  now: Date
): Promise<ConversationResult> {
  const result = applyConversation(conversation, event, waliName);
  if (!result.ok) return result;

  const { id, ...storable } = result.next;

  await withTransaction(async (session) => {
    const db = await getDb();
    /* Guarded on the state we decided from, so two taps on Approve — or
     * an approval racing a close — cannot both land. */
    const updated = await db
      .collection<ConversationDoc>(COLLECTIONS.conversations)
      .updateOne(
        { _id: new ObjectId(id), state: conversation.state },
        { $set: stripUndefined(storable) },
        { session }
      );
    if (updated.matchedCount !== 1) return;

    if (result.systemMessage) {
      await db.collection<MessageDoc>(COLLECTIONS.messages).insertOne(
        {
          _id: new ObjectId(),
          conversationId: id,
          fromUserId: null,
          kind: "system",
          body: result.systemMessage,
          sentAt: now,
        },
        { session }
      );
      await db
        .collection<ConversationDoc>(COLLECTIONS.conversations)
        .updateOne(
          { _id: new ObjectId(id) },
          { $set: { lastMessageAt: now }, $inc: { messageCount: 1 } },
          { session }
        );
    }
  });

  return result;
}
