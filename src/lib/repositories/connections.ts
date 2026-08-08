/* The only module that reads or writes `connectionRequests`,
 * `connectionLedger` and `settings`. */
import { ObjectId, type WithId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb, withTransaction } from "@/lib/db/client";
import { stripUndefined } from "@/lib/db/strip";
import {
  ConnectionRequestSchema,
  applyRequest,
  balanceOf,
  pairKey,
  type ConnectionRequest,
  type LedgerEntry,
  type LedgerReason,
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

/* ----------------------------------------------------------- ledger --- */

type LedgerDoc = LedgerEntry & { _id: ObjectId; period?: string };

async function ledger() {
  return (await getDb()).collection<LedgerDoc>(COLLECTIONS.connectionLedger);
}

/** `2026-08` — the grant period a date falls in. */
export function periodOf(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Gives this month's connections if they have not been given.
 *
 *  Lazy rather than scheduled: there is no job runner, and a grant that
 *  depends on cron having run is a grant that silently stops. The unique
 *  index on `{userId, period}` is what makes two simultaneous reads
 *  produce one grant rather than two. */
export async function ensureMonthlyGrant(
  userId: string,
  settings: Settings,
  now: Date
): Promise<void> {
  if (settings.grantPerMonth <= 0) return;
  const period = periodOf(now);

  try {
    await (await ledger()).insertOne({
      _id: new ObjectId(),
      userId,
      delta: settings.grantPerMonth,
      reason: "monthlyGrant",
      requestId: null,
      at: now,
      byUserId: null,
      note: null,
      period,
    });
  } catch (err) {
    /* 11000 means this month's grant already exists, which is the
     * expected outcome on every read but the first. */
    if (typeof err !== "object" || (err as { code?: number }).code !== 11000) throw err;
  }
}

export async function ledgerFor(userId: string): Promise<LedgerEntry[]> {
  const docs = await (await ledger()).find({ userId }, { sort: { at: -1 } }).toArray();
  return docs.map(({ _id, ...rest }) => rest as LedgerEntry);
}

export async function balanceFor(userId: string): Promise<number> {
  return balanceOf(await ledgerFor(userId));
}

async function addLedger(
  entry: Omit<LedgerEntry, "at"> & { at?: Date },
  now: Date,
  session?: Parameters<typeof withTransaction>[0] extends never ? never : unknown
): Promise<void> {
  await (await ledger()).insertOne(
    stripUndefined({ _id: new ObjectId(), ...entry, at: entry.at ?? now }) as LedgerDoc,
    session ? { session: session as never } : undefined
  );
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

/** Sends a request and moves the connection in one transaction.
 *
 *  A request without its ledger entry is a free connection; a ledger
 *  entry without its request is one taken for nothing. Neither is
 *  recoverable without a person reading the collections side by side. */
export async function sendRequest(
  from: string,
  to: string,
  cost: number,
  settings: Settings,
  now: Date
): Promise<{ ok: true; request: ConnectionRequest } | { ok: false; error: "already-asked" }> {
  const _id = new ObjectId();
  const record: RequestDoc = {
    _id,
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
    await withTransaction(async (session) => {
      const db = await getDb();
      await db.collection<RequestDoc>(COLLECTIONS.connectionRequests).insertOne(record, { session });
      if (cost > 0) {
        await db.collection(COLLECTIONS.connectionLedger).insertOne(
          {
            _id: new ObjectId(),
            userId: from,
            delta: -cost,
            reason: "reservedForRequest" as LedgerReason,
            requestId: _id.toHexString(),
            at: now,
            byUserId: null,
            note: null,
          },
          { session }
        );
      }
    });
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return { ok: false, error: "already-asked" };
    }
    throw err;
  }

  return { ok: true, request: toDomain(record) };
}

/** Answers a request and settles the connection together. */
export async function answerRequest(
  request: ConnectionRequest,
  event: RequestEvent,
  settings: Settings,
  now: Date
): Promise<{ ok: true; state: ConnectionRequest["state"] } | { ok: false; error: string }> {
  const result = applyRequest(request, event, settings);
  if (!result.ok) return { ok: false, error: result.error };

  const { id, ...storable } = result.next;

  await withTransaction(async (session) => {
    const db = await getDb();
    /* Guarded on `pending` inside the update: two taps, or an expiry
     * sweep landing at the same moment, must not both settle it. */
    const updated = await db
      .collection<RequestDoc>(COLLECTIONS.connectionRequests)
      .updateOne({ _id: new ObjectId(id), state: "pending" }, { $set: stripUndefined(storable) }, { session });
    if (updated.matchedCount !== 1) return;

    if (result.ledger === "consumedOnAccept") {
      /* Under `reserve` the connection was already taken when it was
       * sent, so acceptance is a bookkeeping entry of zero rather than a
       * second charge. Under `onAccept` this is the charge. */
      const delta = settings.connectionCharge === "reserve" ? 0 : -1;
      if (delta !== 0 || settings.connectionCharge === "reserve") {
        await db.collection(COLLECTIONS.connectionLedger).insertOne(
          {
            _id: new ObjectId(),
            userId: request.fromUserId,
            delta,
            reason: "consumedOnAccept",
            requestId: id,
            at: now,
            byUserId: null,
            note: null,
          },
          { session }
        );
      }
    } else if (result.ledger) {
      await db.collection(COLLECTIONS.connectionLedger).insertOne(
        {
          _id: new ObjectId(),
          userId: request.fromUserId,
          delta: 1,
          reason: result.ledger,
          requestId: id,
          at: now,
          byUserId: null,
          note: null,
        },
        { session }
      );
    }
  });

  return { ok: true, state: result.next.state };
}
