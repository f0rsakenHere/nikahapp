/* Exporting and erasing everything held about one person.
 *
 * The two halves of the same right (§10.2). Kept together because they
 * have to agree: anything the export can show is something the erasure
 * must remove, and the day those two lists disagree is the day a
 * compliance answer becomes untrue.
 */
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb, withTransaction } from "@/lib/db/client";
import { redactForExport, pseudonymiseEntry, type DataExport } from "@/lib/domain/lifecycle";

/** Everything we hold, in a machine-readable form. Law 25 asks for a
 *  "structured, commonly used technological format" — so, JSON. */
export async function exportEverything(userId: string): Promise<DataExport | null> {
  if (!ObjectId.isValid(userId)) return null;
  const db = await getDb();
  const _id = new ObjectId(userId);

  const account = await db.collection(COLLECTIONS.users).findOne({ _id });
  if (!account) return null;

  const profile = await db.collection(COLLECTIONS.profiles).findOne({ userId: _id });
  const guardianships = await db
    .collection(COLLECTIONS.guardianships)
    .find({ $or: [{ memberUserId: userId }, { waliUserId: userId }] })
    .toArray();
  const verifications = await db
    .collection(COLLECTIONS.verifications)
    .find({ "subject.userId": userId })
    .toArray();

  /* The activity list is deliberately thin: the action and when. The
   * audit log also records who else touched their record and from which
   * address, and handing a member the movements of a named staff member
   * would be disclosing somebody else's personal information in the act
   * of honouring their own request. */
  const activity = await db
    .collection(COLLECTIONS.auditLog)
    .find({ "subject.id": { $in: [userId, profile?._id?.toHexString()].filter(Boolean) } } as never, {
      sort: { at: 1 },
      projection: { action: 1, at: 1, _id: 0 },
    })
    .toArray();

  return {
    exportedAt: new Date().toISOString(),
    account: redactForExport(account as Record<string, unknown>),
    profile: profile ? redactForExport(profile as Record<string, unknown>) : null,
    guardianships: guardianships.map((g) => redactForExport(g as Record<string, unknown>)),
    verifications: verifications.map((v) => redactForExport(v as Record<string, unknown>)),
    activity: (activity as unknown as { at: Date; action: string }[]).map((e) => ({
      at: e.at.toISOString(),
      action: e.action,
    })),
  };
}

/** A stable, one-way name for someone who has been erased.
 *
 *  Derived from the id and a server secret so that entries about one
 *  person still group together — "did the same account do this twice"
 *  stays answerable — while the pseudonym cannot be reversed or
 *  recomputed by anyone who only has the database. */
function pseudonymFor(userId: string): string {
  const salt = process.env.ERASURE_PSEUDONYM_SALT ?? "nikahcanada-erasure";
  return "erased-" + createHash("sha256").update(`${salt}:${userId}`).digest("hex").slice(0, 16);
}

export type ErasureReport = Record<string, number>;

/** Removes the person, keeps the record.
 *
 *  One transaction: a half-erased member is worse than an un-erased one,
 *  because the answer to "have you deleted my data" becomes "some of
 *  it", and nobody can say which.
 */
export async function eraseEverything(userId: string): Promise<ErasureReport> {
  const db = await getDb();
  const _id = new ObjectId(userId);
  const pseudonym = pseudonymFor(userId);
  const report: ErasureReport = {};

  await withTransaction(async (session) => {
    const profiles = await db
      .collection(COLLECTIONS.profiles)
      .find({ userId: _id }, { session })
      .toArray();
    const profileIds = profiles.map((p) => p._id.toHexString());

    report.profiles = (
      await db.collection(COLLECTIONS.profiles).deleteMany({ userId: _id }, { session })
    ).deletedCount;
    report.sessions = (
      await db.collection(COLLECTIONS.sessions).deleteMany({ userId }, { session })
    ).deletedCount;
    report.verificationTokens = (
      await db.collection(COLLECTIONS.verificationTokens).deleteMany({ userId }, { session })
    ).deletedCount;
    report.verifications = (
      await db
        .collection(COLLECTIONS.verifications)
        .deleteMany({ "subject.userId": userId }, { session })
    ).deletedCount;
    /* The link goes; his account does not. He may be wali for somebody
     * else, and it is not hers to close. */
    report.guardianships = (
      await db
        .collection(COLLECTIONS.guardianships)
        .deleteMany({ $or: [{ memberUserId: userId }, { waliUserId: userId }] }, { session })
    ).deletedCount;
    report.users = (
      await db.collection(COLLECTIONS.users).deleteOne({ _id }, { session })
    ).deletedCount;

    /* The audit log is not deleted from — §5.10, and a log with holes
     * punched in it on request is not evidence of anything. Each entry
     * keeps its action and its timestamp; the identifiers become a
     * pseudonym and `meta` goes entirely, because that is where anything
     * identifying would have ended up. */
    const ids = [userId, ...profileIds];
    const entries = await db
      .collection(COLLECTIONS.auditLog)
      .find({ $or: [{ "actor.userId": userId }, { "subject.id": { $in: ids } }] }, { session })
      .toArray();

    for (const entry of entries) {
      const next = pseudonymiseEntry(
        entry as unknown as { actor: { userId: string | null }; subject: { id: string } },
        userId,
        pseudonym
      );
      await db.collection(COLLECTIONS.auditLog).updateOne(
        { _id: entry._id },
        {
          $set: {
            "actor.userId": next.actorUserId,
            "actor.ip": null,
            "actor.userAgent": null,
            "subject.id": ids.includes(String((entry as never as { subject: { id: string } }).subject.id))
              ? pseudonym
              : (entry as never as { subject: { id: string } }).subject.id,
            meta: {},
          },
        },
        { session }
      );
    }
    report.auditLogPseudonymised = entries.length;
  });

  return report;
}
