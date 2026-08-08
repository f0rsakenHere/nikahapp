"use server";

/* Pausing, withdrawing, exporting and erasing — a member's own control
 * over their record (§10.2). */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { record } from "@/lib/audit";
import { currentUser } from "@/lib/auth/current";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { nextStatus, type LifecycleEvent } from "@/lib/domain/lifecycle";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { eraseEverything, exportEverything } from "@/lib/repositories/erasure";

export type LifecycleState = { error?: string; done?: string };

const MESSAGES: Record<string, string> = {
  "cannot-pause": "There is nothing to pause yet — your profile is not live.",
  "not-paused": "Your profile is not paused.",
  "already-gone": "Your profile has already been withdrawn.",
};

export async function changeLifecycle(
  event: LifecycleEvent,
  _prev: LifecycleState,
  form: FormData
): Promise<LifecycleState> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/settings");

  const profile = await findProfileByUserId(session.user.id);
  if (!profile) return { error: "You have no profile to change." };

  const result = nextStatus(profile.status, event);
  if (!result.ok) return { error: MESSAGES[result.error] ?? "That is not possible right now." };

  /* Withdrawing is not reversible and the button says so, so it asks for
   * the password. A shared laptop should not be able to end somebody's
   * search with two clicks. */
  if (event === "withdraw") {
    const password = String(form.get("password") ?? "");
    if (!(await verifyPassword(session.user.passwordHash ?? "", password))) {
      return { error: "That is not your password." };
    }
  }

  const now = new Date();
  await (await getDb())
    .collection(COLLECTIONS.profiles)
    .updateOne(
      { _id: new ObjectId(profile.id) },
      { $set: { status: result.status, updatedAt: now, [`${event}dAt`]: now } }
    );

  await record({
    action: event === "withdraw" ? "profile.withdrawn" : "profile.paused",
    subject: { type: "profile", id: profile.id },
    actor: { userId: session.user.id, role: "member" },
    meta: { from: profile.status, to: result.status },
  });

  revalidatePath("/onboarding");
  revalidatePath("/settings");
  return { done: result.status };
}

/** The export, as a JSON string for the browser to download.
 *
 *  Assembled on request rather than kept anywhere: a file sitting on
 *  disk containing everything about a member is the thing this feature
 *  exists to avoid. */
export async function requestExport(): Promise<{ filename: string; json: string } | null> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/settings");

  const data = await exportEverything(session.user.id);
  if (!data) return null;

  await record({
    action: "account.dataExported",
    subject: { type: "user", id: session.user.id },
    actor: { userId: session.user.id, role: session.user.roles[0] },
  });

  return {
    filename: `nikahcanada-${session.user.id}.json`,
    json: JSON.stringify(data, null, 2),
  };
}

export async function eraseAccount(_prev: LifecycleState, form: FormData): Promise<LifecycleState> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/settings");

  const password = String(form.get("password") ?? "");
  if (!(await verifyPassword(session.user.passwordHash ?? "", password))) {
    return { error: "That is not your password." };
  }
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { error: "Type DELETE to confirm." };
  }

  /* Recorded *before* the erasure, because afterwards there is no
   * account to attribute it to — and "somebody asked to be erased on
   * this date" is exactly the entry a regulator asks for. It is
   * pseudonymised by the erasure itself moments later. */
  await record({
    action: "account.erased",
    subject: { type: "user", id: session.user.id },
    actor: { userId: session.user.id, role: session.user.roles[0] },
  });

  await eraseEverything(session.user.id);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/?erased=1");
}
