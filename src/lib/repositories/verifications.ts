/* The only module that reads or writes `verifications`. */
import { ObjectId, type WithId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { stripUndefined } from "@/lib/db/strip";
import {
  VerificationSchema,
  apply,
  requiredFor,
  type Verification,
  type VerificationEvent,
  type VerificationKind,
  type VerificationResult,
} from "@/lib/domain/verification";

type VerificationDoc = Omit<Verification, "id"> & { _id: ObjectId };

function toDomain(doc: WithId<VerificationDoc>): Verification {
  const { _id, ...rest } = doc;
  return VerificationSchema.parse({ ...rest, id: _id.toHexString() });
}

async function verifications() {
  return (await getDb()).collection<VerificationDoc>(COLLECTIONS.verifications);
}

export async function listVerificationsFor(userId: string): Promise<Verification[]> {
  const docs = await (await verifications())
    .find({ "subject.userId": userId }, { sort: { createdAt: 1 } })
    .toArray();
  return docs.map(toDomain);
}

export async function findVerificationById(id: string): Promise<Verification | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await (await verifications()).findOne({ _id: new ObjectId(id) });
  return doc ? toDomain(doc) : null;
}

/** Opens the checks a member needs, at submission.
 *
 *  Idempotent by kind: submitting twice, or a staff member re-opening a
 *  case, must not produce two identity checks for staff to disagree
 *  over. A *rejected* check is not counted, because asking for a clearer
 *  photograph has to be able to create a fresh one. */
export async function openRequiredChecks(
  userId: string,
  gender: "brother" | "sister",
  seed: { reference?: { name?: string; relationship?: string; organisation?: string; phone?: string } },
  now: Date
): Promise<number> {
  const existing = await listVerificationsFor(userId);
  const live = new Set(
    existing.filter((v) => v.decision !== "rejected").map((v) => v.kind)
  );

  const toOpen = requiredFor(gender).filter((kind) => !live.has(kind));
  if (toOpen.length === 0) return 0;

  await (await verifications()).insertMany(
    toOpen.map((kind: VerificationKind) =>
      stripUndefined({
        _id: new ObjectId(),
        subject: { type: "member" as const, userId },
        kind,
        documents: [],
        /* The reference details the member gave, copied here so the
         * person making the call has the number in front of them rather
         * than in another collection. */
        reference: kind === "reference" ? { ...seed.reference, contactedAt: null, outcome: null } : null,
        call: kind === "intakeCall" ? { scheduledFor: null, completedAt: null, staffUserId: null } : null,
        decision: "pending" as const,
        decidedBy: null,
        decidedAt: null,
        reason: null,
        createdAt: now,
        updatedAt: now,
      })
    ) as VerificationDoc[]
  );

  return toOpen.length;
}

/** Applies a domain event and persists it. The machine decides. */
export async function applyVerification(
  verification: Verification,
  event: VerificationEvent
): Promise<VerificationResult> {
  const result = apply(verification, event);
  if (!result.ok) return result;

  const { id, ...storable } = result.next;
  await (await verifications()).updateOne(
    { _id: new ObjectId(id) },
    { $set: stripUndefined(storable) }
  );
  return result;
}

/** Every check waiting on staff, oldest first. */
export async function listVerificationQueue(limit = 100): Promise<Verification[]> {
  const docs = await (await verifications())
    .find({ decision: { $in: ["pending", "moreInfoNeeded"] } } as never, {
      sort: { createdAt: 1 },
      limit,
    })
    .toArray();
  return docs.map(toDomain);
}
