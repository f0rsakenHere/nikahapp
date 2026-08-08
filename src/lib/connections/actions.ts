"use server";

/* Asking to talk, and answering. */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { record } from "@/lib/audit";
import { currentUser } from "@/lib/auth/current";
import { canSend, type SendRefusal } from "@/lib/domain/connection";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { hasConfirmedWali } from "@/lib/repositories/guardianships";
import {
  answerRequest,
  balanceFor,
  countPendingInbound,
  ensureMonthlyGrant,
  findBetween,
  findRequestById,
  readSettings,
  sendRequest,
} from "@/lib/repositories/connections";
import { browseProfile } from "@/lib/repositories/browse";

export type ConnectState = { error?: string; done?: string };

/* Each refusal gets its own sentence. "She is not taking new requests at
 * the moment" and "you have run out" are not the same disappointment,
 * and a single message for both teaches people to ignore it. */
const REFUSALS: Record<SendRefusal, string> = {
  "no-connections-left":
    "You have no connections left this month. They renew at the start of the next one.",
  "recipient-inbox-full":
    "They are not taking new requests at the moment. Try again in a few days — this happens when someone has several waiting.",
  "already-asked": "You already have a request open with them.",
  "already-answered-no": "They have already answered. We do not pass on a second request.",
  "awaiting-your-answer": "They asked you first — answer that instead.",
  "not-verified": "Your own profile has to be live before you can ask anybody.",
  "recipient-not-verified": "That profile is not available.",
  blocked: "That profile is not available.",
  "same-person": "That is your own profile.",
};

export async function sendConnection(
  profileId: string,
  _prev: ConnectState,
  _form: FormData
): Promise<ConnectState> {
  const session = await currentUser();
  if (!session) redirect(`/login?next=/browse/${profileId}`);

  const me = await findProfileByUserId(session.user.id);
  if (!me) redirect("/onboarding");

  const target = await browseProfile(session.user.id, profileId);
  if (!target) return { error: "That profile is not available." };

  const settings = await readSettings();
  const now = new Date();
  await ensureMonthlyGrant(session.user.id, settings, now);

  const toUserId = String(target.userId);
  const existing = await findBetween(session.user.id, toUserId);

  const decision = canSend(
    session.user.id,
    toUserId,
    {
      balance: await balanceFor(session.user.id),
      recipientPending: await countPendingInbound(toUserId),
      existingBetweenPair: existing?.state ?? null,
      /* A live profile has already passed its checks — that is what
       * `live` means after the review queue. */
      senderVerified: me.status === "live",
      recipientVerified: true,
      senderGender: me.gender,
      blocked: false,
    },
    settings
  );

  if (!decision.ok) return { error: REFUSALS[decision.reason] };

  const sent = await sendRequest(session.user.id, toUserId, decision.cost, settings, now);
  if (!sent.ok) return { error: REFUSALS["already-asked"] };

  await record({
    action: "connection.requested",
    subject: { type: "connectionRequest", id: sent.request.id },
    actor: { userId: session.user.id, role: "member" },
    meta: { cost: decision.cost },
  });

  revalidatePath("/browse");
  revalidatePath("/requests");
  return { done: "sent" };
}

export async function answerConnection(
  requestId: string,
  _prev: ConnectState,
  form: FormData
): Promise<ConnectState> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/requests");

  const request = await findRequestById(requestId);
  if (!request) return { error: "That request no longer exists." };

  const answer = String(form.get("answer") ?? "");
  const mine = request.toUserId === session.user.id;
  const isSender = request.fromUserId === session.user.id;

  /* Ownership, not just possession of an id. Answering somebody else's
   * request is the obvious way to abuse a form that takes an id. */
  if (answer === "withdraw" ? !isSender : !mine) {
    return { error: "That request is not yours to answer." };
  }

  const settings = await readSettings();
  const now = new Date();

  const event =
    answer === "accept"
      ? ({ type: "accept", at: now } as const)
      : answer === "decline"
        ? ({ type: "decline", at: now, reason: String(form.get("reason") ?? "").trim() || undefined } as const)
        : answer === "withdraw"
          ? ({ type: "withdraw", at: now } as const)
          : answer === "block"
            ? ({ type: "block", at: now } as const)
            : null;

  if (!event) return { error: "Choose an answer." };

  /* Accepting is what starts a conversation, and for a sister that
   * cannot happen without a confirmed wali — the same gate as go-live,
   * checked again because this is a different door into the same room. */
  if (event.type === "accept" && settings.waliGate === "approves") {
    const profile = await findProfileByUserId(session.user.id);
    if (profile?.gender === "sister" && !(await hasConfirmedWali(session.user.id))) {
      return { error: "Your wali has to confirm before a conversation can open." };
    }
  }

  const result = await answerRequest(request, event, settings, now);
  if (!result.ok) return { error: "That has already been answered." };

  await record({
    action: event.type === "accept" ? "connection.accepted" : "connection.declined",
    subject: { type: "connectionRequest", id: requestId },
    actor: { userId: session.user.id, role: "member" },
    meta: { answer },
  });

  revalidatePath("/requests");
  revalidatePath("/browse");
  return { done: result.state };
}
