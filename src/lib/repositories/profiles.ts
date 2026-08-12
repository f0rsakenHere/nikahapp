/* The only module that reads or writes `profiles`. */
import { ObjectId, type WithId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { stripUndefined } from "@/lib/db/strip";
import {
  ProfileDraftSchema,
  completeness,
  poolStatuses,
  type ProfileDraft,
} from "@/lib/domain/profile";
import { DAY, NEW_DAYS, TOUCH_EVERY } from "@/lib/domain/activity";

type ProfileDoc = Omit<ProfileDraft, "id" | "userId"> & { _id: ObjectId; userId: ObjectId };

/** Parses on the way out, so a document written by an older shape fails
 *  here rather than three screens later with a missing array.
 *
 *  Progress is recomputed rather than read, so it can never disagree
 *  with the answers — including for the document written at sign-up,
 *  before a single question has been asked.
 *
 *  Computed without the guardianship, because this module does not read
 *  it. For a sister that understates by one step until her wali
 *  confirms, so any screen that knows the guardianship recomputes with
 *  it. The stored value is a denormalised copy for staff lists. */
function toDomain(doc: WithId<ProfileDoc>): ProfileDraft {
  const { _id, userId, ...rest } = doc;
  const parsed = ProfileDraftSchema.parse({
    ...rest,
    id: _id.toHexString(),
    userId: userId.toHexString(),
  });
  return { ...parsed, completeness: completeness(parsed) };
}

async function profiles() {
  return (await getDb()).collection<ProfileDoc>(COLLECTIONS.profiles);
}


export async function findProfileByUserId(userId: string): Promise<ProfileDraft | null> {
  if (!ObjectId.isValid(userId)) return null;
  const doc = await (await profiles()).findOne({ userId: new ObjectId(userId) });
  return doc ? toDomain(doc) : null;
}

/** Sections a member's own form may write.
 *
 *  Deliberately narrow. `gender`, `status`, `userId` and `initials` are
 *  not in it — gender is immutable after signup (§5.2) and status is
 *  moved by staff, so accepting either from a form would let a member
 *  publish their own profile by editing a request. */
export type WritableSection =
  | "basics"
  | "background"
  | "deen"
  | "education"
  | "work"
  | "family"
  | "reference"
  | "lookingFor"
  | "freeText";

/** Merges one step's answers into the draft and recomputes progress.
 *
 *  Returns the saved profile, or a list of validation issues. Nothing is
 *  written when validation fails — a half-saved step is worse than an
 *  unsaved one, because the member cannot see what did and did not
 *  survive. */
export async function saveProfileSection(
  userId: string,
  patch: Partial<Pick<ProfileDraft, WritableSection>>,
  now: Date
): Promise<{ ok: true; profile: ProfileDraft } | { ok: false; issues: string[] }> {
  const current = await findProfileByUserId(userId);
  if (!current) return { ok: false, issues: ["no profile for this account"] };

  /* Merge one level into each section, not over it. A step submits only
   * the fields it showed, so replacing `background` wholesale would drop
   * `childrenDetail` — a field a member filled in on a different screen
   * and would have no way of knowing had vanished. */
  const merged: Record<string, unknown> = { ...current, updatedAt: now };
  for (const [section, values] of Object.entries(patch)) {
    const existing = (current as unknown as Record<string, unknown>)[section];
    merged[section] =
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? { ...(existing as object), ...(values as object) }
        : values;
  }
  const parsed = ProfileDraftSchema.safeParse(merged);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }

  const next = { ...parsed.data, completeness: completeness(parsed.data) };
  const { id: _id, userId: _userId, ...storable } = next;

  /* No `$unset`, deliberately: each section is written as a whole
   * subdocument, so a cleared answer is simply absent from the object
   * that replaces it. Adding `$unset` for the same paths is not
   * belt-and-braces but an error — MongoDB rejects an update whose
   * operators touch the same path twice. */
  await (await profiles()).updateOne(
    { userId: new ObjectId(userId) },
    { $set: { ...stripUndefined(storable), updatedAt: now } }
  );

  return { ok: true, profile: next };
}

/** Moves a finished draft to the review queue.
 *
 *  Guarded on the *current* status inside the update rather than checked
 *  first and written after: two taps on a slow connection would
 *  otherwise both pass the check, and the second would silently reset a
 *  profile staff had already begun looking at. Whether it is finished is
 *  the caller's question — `submitBlockers` answers it, and it needs the
 *  guardianship, which this module does not read. */
export async function submitForReview(
  userId: string,
  now: Date
): Promise<{ ok: true } | { ok: false; error: "not-a-draft" }> {
  const result = await (await profiles()).updateOne(
    { userId: new ObjectId(userId), status: "draft" },
    { $set: { status: "pendingReview", updatedAt: now, submittedAt: now } }
  );
  return result.matchedCount === 1 ? { ok: true } : { ok: false, error: "not-a-draft" };
}

/** Records that this member was here.
 *
 *  Called from the app's chrome, so it runs on every member screen and
 *  no page has to remember to do it. Cheap enough to sit there: the
 *  interval is in the filter, so all but one render an hour matches
 *  nothing and writes nothing, and there is no read first — a
 *  find-then-write would double the round trips to save nothing.
 *
 *  Never throws into the caller. A page that failed to render because
 *  presence could not be recorded would be trading the whole screen for
 *  a badge on somebody else's card. */
export async function touchActivity(userId: string, now: Date): Promise<void> {
  if (!ObjectId.isValid(userId)) return;
  try {
    await (await profiles()).updateOne(
      {
        userId: new ObjectId(userId),
        $or: [
          { lastActiveAt: { $lt: new Date(now.getTime() - TOUCH_EVERY) } },
          { lastActiveAt: { $exists: false } },
        ],
      } as never,
      { $set: { lastActiveAt: now } } as never
    );
  } catch {
    /* Deliberately swallowed. See above. */
  }
}

/** What the pool actually holds, for the screens that say so.
 *
 *  Counted, never estimated and never configured: a members figure that
 *  is anything other than the number of live profiles is a lie a member
 *  can catch by counting the cards in front of them.
 *
 *  Both counts are of the whole pool rather than of what one reader may
 *  see. The reader's own view is filtered by gender, by their filters
 *  and by who has a wali — a number that moved when you changed the age
 *  slider would be answering a different question from the one the
 *  sentence asks. */
export async function poolCounts(
  now: Date,
  settings: { requireVerifiedToBrowse: boolean }
): Promise<{ total: number; newThisWeek: number }> {
  const col = await profiles();
  const status = { $in: poolStatuses(settings) };
  const since = new Date(now.getTime() - NEW_DAYS * DAY);
  const [total, newThisWeek] = await Promise.all([
    col.countDocuments({ status } as never),
    /* Approved on one branch, submitted on the other. `liveAt` is only
       written when staff approve, so counting it alone reported nought
       new every week for as long as the queue went unworked — the one
       number on the screen that would have looked most like a dead
       product. */
    col.countDocuments({
      status,
      $or: [
        { liveAt: { $gte: since } },
        { liveAt: { $exists: false }, submittedAt: { $gte: since } },
      ],
    } as never),
  ]);
  return { total, newThisWeek };
}

export type QueueRow = {
  profileId: string;
  userId: string;
  gender: "brother" | "sister";
  initials: string | null;
  city?: string;
  province?: string;
  birthYear?: number;
  submittedAt: Date | null;
  status: ProfileDraft["status"];
};

/** The review queue: oldest first, because the person who has been
 *  waiting longest is the one to serve next. */
export async function listQueue(
  status: ProfileDraft["status"] = "pendingReview",
  limit = 100
): Promise<QueueRow[]> {
  const docs = await (await profiles())
    .find({ status } as never, { sort: { submittedAt: 1, updatedAt: 1 }, limit })
    .toArray();

  return docs.map((d) => {
    const doc = d as unknown as ProfileDoc & { submittedAt?: Date };
    return {
      profileId: doc._id.toHexString(),
      userId: doc.userId.toHexString(),
      gender: doc.gender,
      initials: doc.initials,
      city: doc.basics?.city,
      province: doc.basics?.province,
      birthYear: doc.basics?.birthYear,
      submittedAt: doc.submittedAt ?? null,
      status: doc.status,
    };
  });
}

export async function findProfileById(profileId: string): Promise<ProfileDraft | null> {
  if (!ObjectId.isValid(profileId)) return null;
  const doc = await (await profiles()).findOne({ _id: new ObjectId(profileId) });
  return doc ? toDomain(doc) : null;
}

export type Decision = "live" | "rejected" | "verifying";

/** Records a staff decision.
 *
 *  Guarded on the profile still being in the queue, inside the update.
 *  Two reviewers opening the same row is the ordinary case in a shared
 *  queue, not a race worth ignoring — the second one is told it has
 *  already been decided rather than silently overwriting the first. */
export async function decideProfile(
  profileId: string,
  decision: Decision,
  by: { userId: string; reason?: string },
  now: Date
): Promise<{ ok: true } | { ok: false; error: "already-decided" }> {
  const result = await (await profiles()).updateOne(
    { _id: new ObjectId(profileId), status: { $in: ["pendingReview", "verifying"] } } as never,
    {
      $set: {
        status: decision,
        updatedAt: now,
        decidedAt: now,
        decidedBy: by.userId,
        decisionReason: by.reason ?? null,
        ...(decision === "live" ? { liveAt: now } : {}),
      },
    } as never
  );
  return result.matchedCount === 1 ? { ok: true } : { ok: false, error: "already-decided" };
}
