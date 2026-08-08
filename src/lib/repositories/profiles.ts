/* The only module that reads or writes `profiles`. */
import { ObjectId, type WithId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { stripUndefined } from "@/lib/db/strip";
import { ProfileDraftSchema, completeness, type ProfileDraft } from "@/lib/domain/profile";

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
