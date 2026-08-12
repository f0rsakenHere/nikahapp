"use server";

/* Asking to talk, and answering. */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { record } from "@/lib/audit";
import { notify, notifyAll } from "@/lib/repositories/notifications";
import { currentUser } from "@/lib/auth/current";
import { canSend, type SendRefusal } from "@/lib/domain/connection";
import { inPool } from "@/lib/domain/profile";
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
import { createConversation } from "@/lib/repositories/conversations";
import { listGuardianshipsForMember } from "@/lib/repositories/guardianships";

export type ConnectState = { error?: string; done?: string };

/** Which of these two is the sister, if either. The wali hangs off her
 *  side of the pair, and a conversation has at most one. */
async function sisterAmong(userIds: string[]): Promise<string | null> {
  for (const id of userIds) {
    const p = await findProfileByUserId(id);
    if (p?.gender === "sister") return id;
  }
  return null;
}

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
  /* Same refusal, different world. Under deferred approval "live" is a
     thing staff do afterwards, so telling a member to wait for it would
     be describing a queue that is not standing between them and this. */
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

  const settings = await readSettings();
  const target = await browseProfile(session.user.id, profileId, settings);
  if (!target) return { error: "That profile is not available." };

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
      /* `browseProfile` above already refused anybody outside the pool,
       * so the recipient is in it by the time we reach here. The sender
       * is checked properly: nothing else on this path looks at their
       * own status, and a draft must not be able to spend a connection
       * on somebody who cannot see them back. */
      senderInPool: inPool(me.status, settings),
      recipientInPool: true,
      senderGender: me.gender,
      blocked: false,
    },
    settings
  );

  if (!decision.ok) {
    return {
      error:
        decision.reason === "not-verified" && !settings.requireVerifiedToBrowse
          ? "Your profile has to be finished and sent in before you can ask anybody."
          : REFUSALS[decision.reason],
    };
  }

  const sent = await sendRequest(session.user.id, toUserId, decision.cost, settings, now);
  if (!sent.ok) return { error: REFUSALS["already-asked"] };

  await record({
    action: "connection.requested",
    subject: { type: "connectionRequest", id: sent.request.id },
    actor: { userId: session.user.id, role: "member" },
    meta: { cost: decision.cost },
  });

  /* Told, rather than left to be noticed. Never who asked — the
     requests screen shows initials and does its own authorisation. */
  await notify(toUserId, {
    kind: "request.received",
    body: "Somebody has asked to talk to you.",
    href: "/requests",
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

  /* Accepting is what starts a conversation, and that cannot happen
   * without the sister's confirmed wali — the same gate as go-live,
   * checked again because this is a different door into the same room.
   *
   * The question is asked about the *pair*, not about whoever pressed
   * the button. Checking only the accepting member left a real hole: a
   * sister with no wali sends the request, the brother accepts, and
   * because he has no wali step to fail the thread opened with no
   * guardian in it at all. Whose finger is on the button has nothing to
   * do with whether a guardian exists. */
  if (event.type === "accept" && settings.waliGate === "approves") {
    const sister = await sisterAmong([request.fromUserId, request.toUserId]);
    if (sister && !(await hasConfirmedWali(sister))) {
      return {
        error:
          sister === session.user.id
            ? "Your wali has to confirm before a conversation can open."
            : "A conversation cannot open until her wali has confirmed.",
      };
    }
  }

  const result = await answerRequest(request, event, settings, now);
  if (!result.ok) return { error: "That has already been answered." };

  /* Acceptance is what creates the thread. It is created in the state
   * the wali gate implies rather than created open and hidden: a
   * conversation that exists and is concealed is one bug away from being
   * visible, and one in `awaitingWali` cannot be written to at all. */
  if (event.type === "accept") {
    const sisterUserId = await sisterAmong([request.fromUserId, request.toUserId]);
    const wali = sisterUserId
      ? (await listGuardianshipsForMember(sisterUserId)).find((g) => g.status === "confirmed")
      : undefined;

    const participants = [
      { userId: request.fromUserId, role: "member" as const, canWrite: true },
      { userId: request.toUserId, role: "member" as const, canWrite: true },
      ...(wali?.waliUserId
        ? [{ userId: wali.waliUserId, role: "wali" as const, canWrite: settings.waliCanWrite }]
        : []),
    ];

    const conversation = await createConversation(
      {
        requestId: request.id,
        participants,
        /* No wali means no gate to wait on — a pair of brothers cannot
         * happen, but a sister whose gate is set to `observes` can. */
        awaitingWali: settings.waliGate === "approves" && Boolean(wali?.waliUserId),
      },
      now
    );

    await record({
      action: "conversation.opened",
      subject: { type: "conversation", id: conversation.id },
      actor: { userId: session.user.id, role: "member" },
      meta: { awaitingWali: conversation.state === "awaitingWali" },
    });
  }

  await record({
    action: event.type === "accept" ? "connection.accepted" : "connection.declined",
    subject: { type: "connectionRequest", id: requestId },
    actor: { userId: session.user.id, role: "member" },
    meta: { answer },
  });

  /* The other side of the request, whichever side answered it. A
     decline says only that it is closed: passing on her actual answer
     is the disclosure `discloseDecline` exists to prevent. */
  const otherParty = mine ? request.fromUserId : request.toUserId;
  if (event.type === "accept") {
    await notify(otherParty, {
      kind: "request.accepted",
      body: "Your request was accepted. The conversation opens once the wali approves.",
      href: "/requests",
    });
  } else if (event.type === "decline" || event.type === "block") {
    await notify(otherParty, {
      kind: "request.declined",
      body: "One of your requests is now closed.",
      href: "/requests",
    });
  } else if (event.type === "withdraw") {
    await notify(otherParty, {
      kind: "request.withdrawn",
      body: "A request waiting on you was withdrawn.",
      href: "/requests",
    });
  }

  revalidatePath("/requests");
  revalidatePath("/browse");
  return { done: result.state };
}
