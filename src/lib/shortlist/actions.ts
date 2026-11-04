"use server";

/* Saving somebody, and passing on them. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current";
import { browseProfile } from "@/lib/repositories/browse";
import { readSettings } from "@/lib/repositories/connections";
import { mark, markOn, unmark, type MarkKind } from "@/lib/repositories/shortlist";

export type MarkState = { error?: string; kind?: MarkKind | "none" };

/** Toggles a mark on a profile.
 *
 *  Which mark is asked for comes from the form — the submit button that
 *  was pressed carries it — and not from an argument bound at render
 *  time. Two reasons. A bound argument has to be computed from the card
 *  as it was last drawn, so it goes stale; and binding the same server
 *  action twice in one component gave the two buttons separate pieces
 *  of client state, only one of which could be shown at a time.
 *
 *  Whether this is a set or a removal is decided here, against the
 *  stored mark: pressing a heart that is already lit un-saves, and
 *  pressing one that is not saves, whatever the page happened to think.
 *
 *  Deliberately not audited. The audit log exists for acts with a
 *  subject who has a right to know, and the whole point of this feature
 *  is that the person marked is never told. Writing "member X passed on
 *  member Y" into an append-only log that staff read would create
 *  exactly the record the interface refuses to show. */
export async function setMark(
  profileId: string,
  _prev: MarkState,
  form: FormData
): Promise<MarkState> {
  const wanted = form.get("mark");
  if (wanted !== "saved" && wanted !== "passed") return { error: "That is not a mark." };

  const session = await currentUser();
  if (!session) redirect(`/login?next=/browse/${profileId}`);

  /* Through `browseProfile` rather than straight to the collection: it
     is the one place that decides who this member may see at all, and a
     mark on somebody they cannot see would be a small privacy leak
     dressed as a bookmark. */
  const target = await browseProfile(session.user.id, profileId, await readSettings());
  if (!target) return { error: "That profile is not available." };

  const next: MarkKind | "none" =
    (await markOn(session.user.id, profileId)) === wanted ? "none" : wanted;

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
