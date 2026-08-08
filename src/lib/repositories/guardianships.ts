/* The only module that reads or writes `guardianships`. */
import { ObjectId, type WithId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb, withTransaction } from "@/lib/db/client";
import { stripUndefined } from "@/lib/db/strip";
import {
  GuardianshipSchema,
  activeGuardianship,
  transition,
  type Guardianship,
  type GuardianshipEvent,
  type TransitionResult,
} from "@/lib/domain/guardianship";

type GuardianshipDoc = Omit<Guardianship, "id"> & { _id: ObjectId };

function toDomain(doc: WithId<GuardianshipDoc>): Guardianship {
  const { _id, ...rest } = doc;
  return GuardianshipSchema.parse({ ...rest, id: _id.toHexString() });
}

async function guardianships() {
  return (await getDb()).collection<GuardianshipDoc>(COLLECTIONS.guardianships);
}

export async function createGuardianship(
  input: Omit<Guardianship, "id">
): Promise<Guardianship> {
  const _id = new ObjectId();
  await (await guardianships()).insertOne(stripUndefined({ _id, ...input }));
  return { ...input, id: _id.toHexString() };
}

export async function listGuardianshipsForMember(memberUserId: string): Promise<Guardianship[]> {
  const docs = await (await guardianships())
    .find({ memberUserId }, { sort: { "invited.invitedAt": -1 } })
    .toArray();
  return docs.map(toDomain);
}

export async function findGuardianshipByTokenHash(
  tokenHash: string
): Promise<Guardianship | null> {
  const doc = await (await guardianships()).findOne({ "invited.tokenHash": tokenHash });
  return doc ? toDomain(doc) : null;
}

/** The wards a wali currently holds a confirmed guardianship for. */
export async function listWardsForWali(waliUserId: string): Promise<Guardianship[]> {
  const docs = await (await guardianships())
    .find({ waliUserId, status: "confirmed" }, { sort: { confirmedAt: -1 } })
    .toArray();
  return docs.map(toDomain);
}

/** Whether this member has a confirmed wali right now.
 *
 *  The one fact `profileMayGoLive` and `submitBlockers` need, and the
 *  reason the onboarding screen was reporting `false` for everybody. */
export async function hasConfirmedWali(memberUserId: string): Promise<boolean> {
  const active = activeGuardianship(await listGuardianshipsForMember(memberUserId));
  return active.ok && active.guardianship !== null;
}

/** Applies a domain transition and persists the result.
 *
 *  The machine decides; this only writes. `memberHasOtherConfirmedWali`
 *  is looked up here because it is the one rule that spans documents,
 *  and the pure function must not go looking for it itself. */
export async function applyTransition(
  guardianship: Guardianship,
  event: GuardianshipEvent,
  options: { maxReminders?: number } = {}
): Promise<TransitionResult> {
  const others = (await listGuardianshipsForMember(guardianship.memberUserId)).filter(
    (g) => g.id !== guardianship.id
  );

  const result = transition(guardianship, event, {
    memberHasOtherConfirmedWali: others.some((g) => g.status === "confirmed"),
    maxReminders: options.maxReminders ?? 3,
  });

  if (!result.ok) return result;

  const { id, ...storable } = result.next;
  await (await guardianships()).updateOne(
    { _id: new ObjectId(id) },
    { $set: stripUndefined(storable) }
  );
  return result;
}

/** Accepting an invitation: the wali's account and the guardianship move
 *  together, or neither does.
 *
 *  §5.12 does not list this, but it belongs in the same family. A
 *  confirmed guardianship pointing at an account that was never created
 *  would hand a woman a wali who cannot sign in — and the screen would
 *  tell her she is ready for review. */
export async function confirmWithNewAccount(
  guardianship: Guardianship,
  account: { email: string; passwordHash: string; legalName: { first: string; last?: string } },
  now: Date
): Promise<{ ok: true; waliUserId: string } | { ok: false; error: string }> {
  const waliUserId = new ObjectId();

  const result = transition(
    guardianship,
    { type: "accept", at: now, waliUserId: waliUserId.toHexString() },
    { memberHasOtherConfirmedWali: await hasConfirmedWali(guardianship.memberUserId), maxReminders: 3 }
  );
  if (!result.ok) return { ok: false, error: result.error };

  const { id, ...storable } = result.next;

  try {
    await withTransaction(async (session) => {
      const db = await getDb();
      await db.collection(COLLECTIONS.users).insertOne(
        {
          _id: waliUserId,
          email: account.email.toLowerCase(),
          /* Accepting an emailed invitation *is* proof he controls the
           * address — asking him to confirm it a second time would be
           * theatre, and one more screen to abandon. */
          emailVerifiedAt: now,
          passwordHash: account.passwordHash,
          roles: ["wali"],
          status: "active",
          locale: "en-CA",
          legalName: account.legalName,
          phone: null,
          dateOfBirth: null,
          mfa: { enabled: false, secret: null },
          lastLoginAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
          tokenVersion: 0,
          closedAt: null,
          closureReason: null,
        },
        { session }
      );
      await db
        .collection<GuardianshipDoc>(COLLECTIONS.guardianships)
        .updateOne({ _id: new ObjectId(id) }, { $set: stripUndefined(storable) }, { session });
    });
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return { ok: false, error: "email-taken" };
    }
    throw err;
  }

  return { ok: true, waliUserId: waliUserId.toHexString() };
}

/** Accepting when he already has an account — the brother who is also
 *  his sister's wali (§2.3), or a man acting for two families. */
export async function confirmWithExistingAccount(
  guardianship: Guardianship,
  waliUserId: string,
  now: Date
): Promise<TransitionResult> {
  const result = await applyTransition(guardianship, { type: "accept", at: now, waliUserId });
  if (result.ok) {
    await (await getDb())
      .collection(COLLECTIONS.users)
      .updateOne({ _id: new ObjectId(waliUserId) }, { $addToSet: { roles: "wali" } });
  }
  return result;
}
