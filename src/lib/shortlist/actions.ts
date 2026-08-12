"use server";

/* Saving somebody, and passing on them. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current";
import { browseProfile } from "@/lib/repositories/browse";
import { readSettings } from "@/lib/repositories/connections";
import { mark, unmark, type MarkKind } from "@/lib/repositories/shortlist";

export type MarkState = { error?: string; kind?: MarkKind | "none" };

/** Toggles a mark on a profile.
 *
 *  `next` is what the caller wants it to become, and "none" removes it —
 *  pressing the heart on somebody already saved un-saves them.
 *
 *  Deliberately not audited. The audit log exists for acts with a
 *  subject who has a right to know, and the whole point of this feature
 *  is that the person marked is never told. Writing "member X passed on
 *  member Y" into an append-only log that staff read would create
 *  exactly the record the interface refuses to show. */
export async function setMark(
  profileId: string,
  next: MarkKind | "none",
  _prev: MarkState,
  _form: FormData
): Promise<MarkState> {
  const session = await currentUser();
  if (!session) redirect(`/login?next=/browse/${profileId}`);

  /* Through `browseProfile` rather than straight to the collection: it
     is the one place that decides who this member may see at all, and a
     mark on somebody they cannot see would be a small privacy leak
     dressed as a bookmark. */
  const target = await browseProfile(session.user.id, profileId, await readSettings());
  if (!target) return { error: "That profile is not available." };

  if (next === "none") {
    await unmark(session.user.id, profileId);
  } else {
    await mark(
      session.user.id,
      { profileId, targetUserId: String(target.userId), kind: next },
      new Date()
    );
  }

  revalidatePath("/browse");
  revalidatePath("/saved");
  revalidatePath(`/browse/${profileId}`);
  return { kind: next };
}
