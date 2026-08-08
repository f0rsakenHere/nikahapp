/* Finding people to browse.
 *
 * The read surface D1 created. Under a curated queue nothing outside the
 * staff console ever searched `profiles`; now every member does, so this
 * is the query that has to stay fast and has to never show somebody who
 * should not be seen.
 */
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { appearsInBrowse } from "@/lib/domain/connection";
import type { Settings } from "@/lib/domain/settings";
import type { MADHHAB, MARITAL_STATUS, PROVINCES } from "@/lib/domain/profile";
import { pendingInboundFor } from "./connections";

export type BrowseFilters = {
  ageMin?: number;
  ageMax?: number;
  provinces?: (typeof PROVINCES)[number][];
  maritalStatus?: (typeof MARITAL_STATUS)[number][];
  madhhab?: (typeof MADHHAB)[number][];
};

export type BrowseCard = {
  profileId: string;
  userId: string;
  initials: string | null;
  gender: "brother" | "sister";
  age: number | null;
  city?: string;
  province?: string;
  occupation?: string;
  salah?: string;
  madhhab?: string;
  maritalStatus?: string;
  /** Already asked, in either direction. Shown rather than hidden: a
   *  member who forgot they asked is better told than left wondering. */
  alreadyAsked: boolean;
};

const YEAR = new Date().getUTCFullYear();

/** The pool this member may see.
 *
 *  Verification and liveness are enforced in the query; the inbound cap
 *  is applied afterwards, because it is a count across another
 *  collection. That is two round trips rather than an aggregation
 *  pipeline, which is the right trade at this size and is the first
 *  thing to revisit when the pool is large enough to notice. */
export async function browseFor(
  viewer: { userId: string; gender: "brother" | "sister" },
  filters: BrowseFilters,
  settings: Settings,
  limit = 40
): Promise<BrowseCard[]> {
  const db = await getDb();

  const wanted = viewer.gender === "brother" ? "sister" : "brother";
  const query: Record<string, unknown> = {
    gender: wanted,
    status: "live",
    userId: { $ne: new ObjectId(viewer.userId) },
  };

  if (filters.ageMin || filters.ageMax) {
    const birthYear: Record<string, number> = {};
    /* Age filters are inclusive at both ends, and a year is a coarse
     * enough unit that being a month out either way is not worth
     * storing a birthday for. */
    if (filters.ageMax) birthYear.$gte = YEAR - filters.ageMax - 1;
    if (filters.ageMin) birthYear.$lte = YEAR - filters.ageMin;
    query["basics.birthYear"] = birthYear;
  }
  if (filters.provinces?.length) query["basics.province"] = { $in: filters.provinces };
  if (filters.maritalStatus?.length) {
    query["background.maritalStatus"] = { $in: filters.maritalStatus };
  }
  if (filters.madhhab?.length) query["deen.madhhab"] = { $in: filters.madhhab };

  const docs = await db
    .collection(COLLECTIONS.profiles)
    .find(query, { sort: { liveAt: -1, updatedAt: -1 }, limit: limit * 3 })
    .toArray();

  const userIds = docs.map((d) => String(d.userId));
  const pending = await pendingInboundFor(userIds);

  /* Anyone this viewer already has a live request with, either way. */
  const existing = await db
    .collection(COLLECTIONS.connectionRequests)
    .find(
      {
        $or: [{ fromUserId: viewer.userId }, { toUserId: viewer.userId }],
        state: { $in: ["pending", "accepted"] },
      } as never,
      { projection: { fromUserId: 1, toUserId: 1 } }
    )
    .toArray();

  const asked = new Set(
    existing.flatMap((r) => [String(r.fromUserId), String(r.toUserId)]).filter((u) => u !== viewer.userId)
  );

  const cards: BrowseCard[] = [];
  for (const doc of docs) {
    const userId = String(doc.userId);

    /* Verification lives on the profile's own checks, which the staff
     * console records; a live profile has passed them by definition, so
     * `live` is the verification signal here. */
    if (
      !appearsInBrowse(
        { verified: true, pendingInbound: pending.get(userId) ?? 0, status: String(doc.status) },
        settings
      )
    ) {
      continue;
    }

    cards.push({
      profileId: doc._id.toHexString(),
      userId,
      initials: (doc.initials as string) ?? null,
      gender: doc.gender as "brother" | "sister",
      age: doc.basics?.birthYear ? YEAR - Number(doc.basics.birthYear) : null,
      city: doc.basics?.city,
      province: doc.basics?.province,
      occupation: doc.work?.occupation,
      salah: doc.deen?.salah,
      madhhab: doc.deen?.madhhab,
      maritalStatus: doc.background?.maritalStatus,
      alreadyAsked: asked.has(userId),
    });

    if (cards.length >= limit) break;
  }

  return cards;
}

/** One profile, as a member is allowed to see it.
 *
 *  Never the legal name, never the exact date of birth, never the
 *  photograph — none of which are on this document anyway, which is the
 *  point of §5.2 keeping them elsewhere. */
export async function browseProfile(
  viewerUserId: string,
  profileId: string
): Promise<Record<string, unknown> | null> {
  if (!ObjectId.isValid(profileId)) return null;
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.profiles).findOne({ _id: new ObjectId(profileId) });
  if (!doc || doc.status !== "live") return null;
  if (String(doc.userId) === viewerUserId) return null;

  const { _id, userId, ...rest } = doc;
  return { profileId: _id.toHexString(), userId: String(userId), ...rest };
}
