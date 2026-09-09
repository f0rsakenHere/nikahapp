/* The only module that reads or writes `connectionRequests` and
 * `settings`.
 *
 * It used to own `connectionLedger` as well. That collection was a
 * currency — a monthly grant, a hold on every ask, a refund on every
 * decline — and the plan model deleted the currency. Asking is free and
 * rate-limited (`asksSince`), and what is sold is the conversation. */
import { ObjectId, type WithId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { stripUndefined } from "@/lib/db/strip";
import {
  ConnectionRequestSchema,
  applyRequest,
  pairKey,
  type ConnectionRequest,
  type RequestEvent,
} from "@/lib/domain/connection";
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from "@/lib/domain/settings";

/* --------------------------------------------------------- settings --- */

/** The live settings, or the defaults.
 *
 *  Merged over the defaults rather than replacing them, so a setting
 *  added in code is in force immediately instead of waiting for somebody
 *  to notice the stored document is missing a key. */
export async function readSettings(): Promise<Settings> {
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.settings).findOne({ key: "product" });
  if (!doc) return DEFAULT_SETTINGS;
  const parsed = SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(doc.value ?? {}) });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function writeSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = SettingsSchema.parse({ ...(await readSettings()), ...patch });
  await (await getDb())
    .collection(COLLECTIONS.settings)
    .updateOne({ key: "product" }, { $set: { key: "product", value: next } }, { upsert: true });
  return next;
}

/* ---------------------------------------------------------- requests -- */

type RequestDoc = Omit<ConnectionRequest, "id"> & { _id: ObjectId };

function toDomain(doc: WithId<RequestDoc>): ConnectionRequest {
  const { _id, ...rest } = doc;
  return ConnectionRequestSchema.parse({ ...rest, id: _id.toHexString() });
}

async function requests() {
  return (await getDb()).collection<RequestDoc>(COLLECTIONS.connectionRequests);
}

/** A live request between two people, in either direction. */
export async function findBetween(
  a: string,
  b: string
): Promise<ConnectionRequest | null> {
  const doc = await (await requests()).findOne(
    { pairKey: { $in: [pairKey(a, b), pairKey(b, a)] } } as never,
    { sort: { sentAt: -1 } }
  );
  return doc ? toDomain(doc) : null;
}

export async function countPendingInbound(userId: string): Promise<number> {
  return (await requests()).countDocuments({ toUserId: userId, state: "pending" });
}

/** How many each of these people has waiting, in one query rather than
 *  one per candidate. */
export async function pendingInboundFor(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await (await requests())
    .aggregate([
      { $match: { toUserId: { $in: userIds }, state: "pending" } },
      { $group: { _id: "$toUserId", n: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [String(r._id), r.n as number]));
}

export async function listRequests(
  userId: string,
  direction: "in" | "out"
): Promise<ConnectionRequest[]> {
  const field = direction === "in" ? "toUserId" : "fromUserId";
  const docs = await (await requests())
    .find({ [field]: userId } as never, { sort: { sentAt: -1 }, limit: 100 })
    .toArray();
  return docs.map(toDomain);
}

export async function findRequestById(id: string): Promise<ConnectionRequest | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await (await requests()).findOne({ _id: new ObjectId(id) });
  return doc ? toDomain(doc) : null;
}

/** Records the ask.
 *
 *  A plain insert now. It used to be a transaction because the request
 *  and the ledger entry that paid for it had to land together or not at
 *  all; asking is free, so there is only one write and nothing to keep
 *  consistent with it. The unique index on `pairKey` is still what stops
 *  the same pair being asked twice concurrently. */
export async function sendRequest(
  from: string,
  to: string,
  settings: Settings,
  now: Date
): Promise<{ ok: true; request: ConnectionRequest } | { ok: false; error: "already-asked" }> {
  const record: RequestDoc = {
    _id: new ObjectId(),
    pairKey: pairKey(from, to),
    fromUserId: from,
    toUserId: to,
    state: "pending",
    sentAt: now,
    expiresAt: new Date(now.getTime() + settings.requestExpiryDays * 86_400_000),
    answeredAt: null,
    declineReason: null,
    conversationId: null,
  };

  try {
    const db = await getDb();
    await db.collection<RequestDoc>(COLLECTIONS.connectionRequests).insertOne(record);
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return { ok: false, error: "already-asked" };
    }
    throw err;
  }

  return { ok: true, request: toDomain(record) };
}

/** How many people this member has asked in the last seven days.
 *
 *  The whole of the rate limit. A rolling window rather than a calendar
 *  one, because "your asks reset on Monday" invites somebody to spend
 *  the week's allowance on Sunday night and the next one an hour later.
 *
 *  Counts every request sent in the window whatever became of it — an
 *  ask that was declined still took the recipient's attention, and
 *  refunding attention is not something a database can do. */
export async function asksSince(userId: string, since: Date): Promise<number> {
  const db = await getDb();
  return db
    .collection(COLLECTIONS.connectionRequests)
    .countDocuments({ fromUserId: userId, sentAt: { $gte: since } });
}

/** The start of the rolling week, given now. */
export function weekAgo(now: Date): Date {
  return new Date(now.getTime() - 7 * 86_400_000);
}

/** Answers a request.
 *
 *  "And settles the connection", it used to say, because every answer
 *  either spent the sender's held connection or gave it back. Asking is
 *  free now, so this only moves state — no transaction, no ledger, and
 *  no `settings`. */
export async function answerRequest(
  request: ConnectionRequest,
  event: RequestEvent
): Promise<{ ok: true; state: ConnectionRequest["state"] } | { ok: false; error: string }> {
  const result = applyRequest(request, event);
  if (!result.ok) return { ok: false, error: result.error };

  const { id, ...storable } = result.next;

  /* Guarded on `pending` inside the update: two taps, or an expiry sweep
   * landing at the same moment, must not both settle it. */
  const updated = await (await requests()).updateOne(
    { _id: new ObjectId(id), state: "pending" },
    { $set: stripUndefined(storable) as never }
  );
  if (updated.matchedCount !== 1) return { ok: false, error: "already-answered" };

  return { ok: true, state: result.next.state };
}
