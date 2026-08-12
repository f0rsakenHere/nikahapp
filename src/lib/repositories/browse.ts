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
import { inPool, poolStatuses } from "@/lib/domain/profile";
import type { MADHHAB, MARITAL_STATUS, PROVINCES } from "@/lib/domain/profile";
import { bestOf, scorePair, type Facts, type Preferences } from "@/lib/domain/suggestions";
import { activityBand, isNewToPool, type ActivityBand } from "@/lib/domain/activity";
import {
  MADHHAB_LABELS,
  MARITAL_STATUS_LABELS,
  PROVINCE_LABELS,
} from "@/lib/domain/profile-labels";
import { pendingInboundFor } from "./connections";
import { membersWithConfirmedWali } from "./guardianships";
import { marksFor } from "./shortlist";

/** When this profile joined the pool.
 *
 *  `liveAt` is written when staff approve, so under deferred approval it
 *  is null for everybody who has joined since — which silently emptied
 *  "New this week" and left the badge on nobody. Submission is the other
 *  moment a profile can enter the pool, and one of the two is always
 *  there. */
function enteredPoolAt(doc: Record<string, unknown>): Date | undefined {
  return (doc.liveAt ?? doc.submittedAt) as Date | undefined;
}

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
  children?: string;
  education?: string;
  languages?: string[];
  heightCm?: number;
  willingToRelocate?: string;
  /* Their own words, cut to a card's worth. Trimmed *here* rather than
     in the component: the whole 4,000 characters would otherwise be
     serialised into the page for every profile in the list, whether or
     not any of it is rendered. The rest is on their profile page. */
  about?: string;
  /** Already asked, in either direction. Shown rather than hidden: a
   *  member who forgot they asked is better told than left wondering. */
  alreadyAsked: boolean;
  /** This viewer's private mark. Never the other person's. */
  marked: "saved" | "passed" | "none";
  /* Banded here rather than in the component, so the raw timestamp never
     reaches the browser. Serialised into the page it would be readable
     to the minute by anybody who opened the network tab, which is
     exactly the precision the bands exist to withhold. */
  activity: ActivityBand;
  /** Went live within the last week. */
  isNew: boolean;
};

const YEAR = new Date().getUTCFullYear();

/** A profile document's "looking for", in the shape the scorer wants. */
function preferencesOf(doc: Record<string, any> | null | undefined): Preferences {
  const l = doc?.lookingFor ?? {};
  return {
    ageMin: typeof l.ageMin === "number" ? l.ageMin : undefined,
    ageMax: typeof l.ageMax === "number" ? l.ageMax : undefined,
    provinces: Array.isArray(l.provinces) ? l.provinces.map(String) : [],
    maritalStatus: Array.isArray(l.maritalStatus) ? l.maritalStatus.map(String) : [],
    madhhab: Array.isArray(l.madhhab) ? l.madhhab.map(String) : [],
  };
}

/* Enough to judge whether to read the rest, cut at a word so it does not
   end mid-syllable. */
const EXCERPT_CHARS = 190;

function excerpt(text: unknown): string | undefined {
  if (typeof text !== "string") return undefined;
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return undefined;
  if (clean.length <= EXCERPT_CHARS) return clean;
  const cut = clean.slice(0, EXCERPT_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

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
  limit = 40,
  /* `saved` shows only what they set aside; `all` includes the ones they
     passed on, for the member who wants to reconsider; `new` is the same
     pool cut to the last week. The default hides the passed-over ones,
     which is the point of passing. */
  scope: "pool" | "saved" | "all" | "new" = "pool"
): Promise<BrowseCard[]> {
  const db = await getDb();

  const wanted = viewer.gender === "brother" ? "sister" : "brother";
  const query: Record<string, unknown> = {
    gender: wanted,
    status: { $in: poolStatuses(settings) },
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

  const now = new Date();

  const docs = await db
    .collection(COLLECTIONS.profiles)
    /* Most recently here first, and most recently admitted after that.
       A pool this size in a fixed order is the same screen every visit;
       ordering by presence means the people who would actually answer
       are the ones a member sees without scrolling. */
    /* `submittedAt` sits between the two because under deferred approval
       `liveAt` is never written — it is set when staff approve — and a
       sort that leans on it alone would rank every member who has not
       been approved yet as though they had arrived at the beginning of
       time. */
    .find(query, {
      sort: { lastActiveAt: -1, liveAt: -1, submittedAt: -1, updatedAt: -1 },
      limit: limit * 3,
    })
    .toArray();

  const userIds = docs.map((d) => String(d.userId));
  const pending = await pendingInboundFor(userIds);

  /* A sister with no confirmed wali is not shown to anybody.
   *
   * She cannot be written to — a request to her cannot be accepted into
   * a conversation without him — so listing her is offering a door that
   * does not open, and the brother spends one of his monthly requests
   * finding that out. Submission already requires a confirmed wali, so
   * this catches the profiles that went live and then lost him:
   * withdrawn, replaced, or an invitation that expired afterwards.
   *
   * Only sisters. A brother has no wali step in this product (§5.2) and
   * gating him on something he is never asked for would empty the pool. */
  const withWali =
    wanted === "sister" ? await membersWithConfirmedWali(userIds) : null;

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

  const { saved, passed } = await marksFor(viewer.userId);

  const cards: BrowseCard[] = [];
  for (const doc of docs) {
    const userId = String(doc.userId);

    if (withWali && !withWali.has(userId)) continue;

    const profileId = doc._id.toHexString();
    if (scope === "saved" && !saved.has(profileId)) continue;
    if (scope === "new" && !isNewToPool(enteredPoolAt(doc), now)) continue;
    /* Passed on: out of the pool, but still reachable by the two views
       that exist to look back at a decision. */
    if ((scope === "pool" || scope === "new") && passed.has(profileId)) continue;

    /* The query above already selected on status; this re-asks the same
     * question through the rule rather than the index, and adds the one
     * thing the query cannot see — how many requests are already waiting
     * on this person. */
    if (
      !appearsInBrowse(
        { pendingInbound: pending.get(userId) ?? 0, status: String(doc.status) },
        settings
      )
    ) {
      continue;
    }

    cards.push({
      profileId,
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
      children: doc.background?.children,
      education: doc.education?.level,
      languages: (doc.background?.languages ?? []).slice(0, 3),
      heightCm: doc.basics?.heightCm,
      willingToRelocate: doc.basics?.willingToRelocate,
      about: excerpt(doc.freeText?.aboutMe),
      alreadyAsked: asked.has(userId),
      marked: saved.has(profileId) ? "saved" : passed.has(profileId) ? "passed" : "none",
      activity: activityBand(doc.lastActiveAt as Date | undefined, now),
      isNew: isNewToPool(enteredPoolAt(doc), now),
    });

    if (cards.length >= limit) break;
  }

  return cards;
}

/** The pool, ranked against what this member said they were looking for.
 *
 *  Built on `browseFor` rather than beside it, so every rule about who
 *  may be seen — live, wali confirmed, not at their inbound cap, not
 *  passed over — is enforced in exactly one place. This only reorders
 *  what browse would already have shown, and explains the order. */
export async function suggestionsFor(
  viewer: { userId: string; gender: "brother" | "sister" },
  settings: Settings,
  take = 3
): Promise<{ card: BrowseCard; reasons: string[] }[]> {
  const db = await getDb();

  const mine = await db.collection(COLLECTIONS.profiles).findOne({
    userId: new ObjectId(viewer.userId),
  });
  const myPrefs = preferencesOf(mine);
  const myFacts: Facts = {
    age: mine?.basics?.birthYear ? YEAR - Number(mine.basics.birthYear) : null,
    province: mine?.basics?.province,
    maritalStatus: mine?.background?.maritalStatus,
    madhhab: mine?.deen?.madhhab,
  };

  /* No stated preferences and nothing stated about them is a member the
     ranking has nothing to say about. Better to show nothing than an
     arbitrary three with no reasons under them. */
  const cards = await browseFor(viewer, {}, settings, 60);
  if (cards.length === 0) return [];

  const theirs = await db
    .collection(COLLECTIONS.profiles)
    .find(
      { _id: { $in: cards.map((c) => new ObjectId(c.profileId)) } },
      { projection: { lookingFor: 1 } }
    )
    .toArray();
  const prefsById = new Map(theirs.map((d) => [d._id.toHexString(), preferencesOf(d)]));

  const scored = cards.map((card) => ({
    item: card,
    suggestion: scorePair(
      myPrefs,
      {
        age: card.age,
        province: card.province,
        maritalStatus: card.maritalStatus,
        madhhab: card.madhhab,
      },
      prefsById.get(card.profileId) ?? { provinces: [], maritalStatus: [], madhhab: [] },
      myFacts,
      {
        province: (code) => PROVINCE_LABELS[code as never] ?? code,
        maritalStatus: (code) => MARITAL_STATUS_LABELS[code as never] ?? code,
        madhhab: (code) => MADHHAB_LABELS[code as never] ?? code,
      }
    ),
  }));

  return bestOf(scored, take).map(({ item, suggestion }) => ({
    card: item,
    reasons: suggestion.reasons,
  }));
}

/** One profile, as a member is allowed to see it.
 *
 *  Never the legal name, never the exact date of birth, never the
 *  photograph — none of which are on this document anyway, which is the
 *  point of §5.2 keeping them elsewhere. */
export async function browseProfile(
  viewerUserId: string,
  profileId: string,
  settings: Settings
): Promise<Record<string, unknown> | null> {
  if (!ObjectId.isValid(profileId)) return null;
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.profiles).findOne({ _id: new ObjectId(profileId) });
  if (!doc || !inPool(String(doc.status), settings)) return null;
  if (String(doc.userId) === viewerUserId) return null;

  /* The same wali rule as the list. Filtering only the list would leave
     her reachable by anyone holding the id — including from a card that
     was on screen a minute before she lost her guardian — and this is
     the function `requestConnection` checks against, so it is also what
     stops a request being spent on somebody who cannot answer it. */
  if (doc.gender === "sister") {
    const withWali = await membersWithConfirmedWali([String(doc.userId)]);
    if (!withWali.has(String(doc.userId))) return null;
  }

  const { _id, userId, ...rest } = doc;
  return { profileId: _id.toHexString(), userId: String(userId), ...rest };
}
