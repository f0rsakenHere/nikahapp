/* The only module that reads or writes `profiles`. */
import { ObjectId, type WithId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { ProfileDraftSchema, completeness, type ProfileDraft } from "@/lib/domain/profile";

type ProfileDoc = Omit<ProfileDraft, "id" | "userId"> & { _id: ObjectId; userId: ObjectId };

/** Parses on the way out, so a document written by an older shape fails
 *  here rather than three screens later with a missing array.
 *
 *  Progress is recomputed rather than read. The stored `completeness` is
 *  a denormalised copy for staff queues and list views; deriving it here
 *  means a screen can never show a percentage that disagrees with the
 *  answers on it — including for the document written at sign-up, before
 *  a single question has been asked. */
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

/* Drops keys whose value is `undefined`, one level into each section.
 *
 * The client sets `ignoreUndefined`, which does the same thing — but
 * this does not depend on a connection option being right, and the
 * failure it prevents is nasty: the driver's default is to store
 * `undefined` as `null`, `null` fails every `.optional()` in the schema,
 * and the document therefore saves without complaint and then throws on
 * the next read. Two lines here for a bug that presents three screens
 * away from its cause. */
function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      out[key] = stripUndefined(v as Record<string, unknown>);
    } else {
      out[key] = v;
    }
  }
  return out as T;
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
