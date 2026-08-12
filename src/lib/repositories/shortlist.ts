import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";

/* Saved, and passed on.
 *
 * Browsing a small pool without either is exhausting: the same faces
 * come round every visit, and the only way to keep hold of somebody is
 * to spend one of the month's connections on them. So two marks, both
 * private and neither visible to the person marked:
 *
 *   saved   — set aside to think about, costs nothing
 *   passed  — not for me; drops out of browse
 *
 * Deliberately invisible to the other side. A product that told somebody
 * they had been passed over would be crueller than one that says
 * nothing, and a "saved" count would turn a considered decision into a
 * popularity score. Nobody is ever told, and no total is ever shown.
 */

export type MarkKind = "saved" | "passed";

export type Mark = {
  profileId: string;
  targetUserId: string;
  kind: MarkKind;
  at: Date;
};

type MarkDoc = Mark & { _id: ObjectId; userId: string };

async function marks() {
  return (await getDb()).collection<MarkDoc>(COLLECTIONS.browseMarks);
}

/** Sets a mark, replacing whatever was there. Saving somebody you had
 *  passed on is a change of mind, not an error. */
export async function mark(
  userId: string,
  input: { profileId: string; targetUserId: string; kind: MarkKind },
  now: Date
): Promise<void> {
  await (await marks()).updateOne(
    { userId, profileId: input.profileId },
    { $set: { userId, ...input, at: now } },
    { upsert: true }
  );
}

/** Removes it entirely — un-saving is not the same as passing. */
export async function unmark(userId: string, profileId: string): Promise<void> {
  await (await marks()).deleteOne({ userId, profileId });
}

/** What this member has marked, as two sets, in one query. Browse needs
 *  both on every render and a query per card would be absurd. */
export async function marksFor(userId: string): Promise<{
  saved: Set<string>;
  passed: Set<string>;
}> {
  const docs = await (await marks()).find({ userId }).toArray();
  const saved = new Set<string>();
  const passed = new Set<string>();
  for (const d of docs) (d.kind === "saved" ? saved : passed).add(d.profileId);
  return { saved, passed };
}

/** The saved list, newest first — what the Saved tab shows. */
export async function savedProfileIds(userId: string): Promise<string[]> {
  const docs = await (await marks())
    .find({ userId, kind: "saved" }, { sort: { at: -1 }, projection: { profileId: 1 } })
    .toArray();
  return docs.map((d) => d.profileId);
}

/** Every mark this member has made, for the data export and for erasure.
 *  A mark is personal data about the person who made it. */
export async function marksOf(userId: string): Promise<Mark[]> {
  const docs = await (await marks()).find({ userId }).toArray();
  return docs.map(({ _id, userId: _u, ...rest }) => rest);
}

export async function forgetMarksOf(userId: string): Promise<void> {
  /* Both directions: the marks they made, and the marks made about them.
     A withdrawn member should not linger in somebody else's saved list. */
  await (await marks()).deleteMany({ $or: [{ userId }, { targetUserId: userId }] });
}
