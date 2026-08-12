"use server";

/* The thread: reading it, writing in it, the wali's gate, and ending it. */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { record } from "@/lib/audit";
import { notifyAll } from "@/lib/repositories/notifications";
import { currentUser } from "@/lib/auth/current";
import { isStaffActor } from "@/lib/domain/authorisation";
import { canRead, canSendMessage } from "@/lib/domain/conversation";
import {
  appendMessage,
  applyToConversation,
  findConversationById,
} from "@/lib/repositories/conversations";
import { findGuardianshipForWali } from "@/lib/repositories/guardianships";

export type ThreadState = { error?: string };

const REFUSALS = {
  "not-a-participant": "This conversation is not yours.",
  "not-open": "This conversation is not open.",
  "read-only": "You can read this conversation, and not write in it.",
  empty: "Write something first.",
} as const;

export async function sendMessage(
  conversationId: string,
  _prev: ThreadState,
  form: FormData
): Promise<ThreadState> {
  const session = await currentUser();
  if (!session) redirect(`/login?next=/conversations/${conversationId}`);

  const conversation = await findConversationById(conversationId);
  if (!conversation) return { error: "That conversation no longer exists." };

  const body = String(form.get("body") ?? "");
  const actor = { userId: session.user.id, isStaff: isStaffActor(session.user.roles) };

  const allowed = canSendMessage(conversation, actor, body);
  if (!allowed.ok) return { error: REFUSALS[allowed.reason] };

  await appendMessage(
    conversationId,
    { fromUserId: session.user.id, kind: "member", body },
    new Date()
  );

  /* The message itself is never in the audit meta — the log records that
   * somebody wrote, not what they wrote. The thread is the record of
   * what was said, and it is already immutable. */
  await record({
    action: "conversation.messageSent",
    subject: { type: "conversation", id: conversationId },
    actor: { userId: session.user.id, role: session.user.roles[0] },
  });

  revalidatePath(`/conversations/${conversationId}`);
  return {};
}

/** The wali's gate. */
export async function decideAsWali(
  conversationId: string,
  _prev: ThreadState,
  form: FormData
): Promise<ThreadState> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/wali");

  const conversation = await findConversationById(conversationId);
  if (!conversation) return { error: "That conversation no longer exists." };

  const approving = String(form.get("decision") ?? "") === "approve";
  const reason = String(form.get("reason") ?? "").trim();
  const now = new Date();

  /* His own name, for the line written into the thread. Read from the
   * guardianship rather than the user record, because it is the name she
   * gave when she named him — which is the name both members know him
   * by. Looked up from his side: "the member" of a conversation is
   * whichever seat comes first, which is the brother half the time. */
  const guardianship = await findGuardianshipForWali(
    session.user.id,
    conversation.participants.filter((p) => p.role === "member").map((p) => p.userId)
  );
  const waliName = guardianship?.invited.name ?? session.user.legalName.first;

  const result = await applyToConversation(
    conversation,
    approving
      ? { type: "waliApproves", at: now, waliUserId: session.user.id }
      : { type: "waliDeclines", at: now, waliUserId: session.user.id, reason: reason || undefined },
    waliName,
    now
  );

  if (!result.ok) {
    return {
      error:
        result.error === "not-the-wali"
          ? "You are not the wali for this conversation."
          : "That has already been decided.",
    };
  }

  await record({
    action: approving ? "conversation.waliApproved" : "conversation.waliDeclined",
    subject: { type: "conversation", id: conversationId },
    actor: { userId: session.user.id, role: "wali" },
    meta: reason ? { reason } : {},
  });

  await notifyAll(
    conversation.participants.filter((x) => x.role === "member").map((x) => x.userId),
    approving
      ? {
          kind: "conversation.opened",
          body: "The wali approved. Your conversation is open.",
          href: `/conversations/${conversationId}`,
        }
      : {
          kind: "conversation.closed",
          body: "The wali did not approve a conversation.",
          href: "/conversations",
        }
  );

  revalidatePath("/wali");
  revalidatePath(`/conversations/${conversationId}`);
  return {};
}

export async function closeConversation(
  conversationId: string,
  _prev: ThreadState,
  form: FormData
): Promise<ThreadState> {
  const session = await currentUser();
  if (!session) redirect(`/login?next=/conversations/${conversationId}`);

  const conversation = await findConversationById(conversationId);
  if (!conversation) return { error: "That conversation no longer exists." };

  const isStaff = isStaffActor(session.user.roles);
  if (!canRead(conversation, { userId: session.user.id, isStaff })) {
    return { error: "This conversation is not yours." };
  }

  const result = await applyToConversation(
    conversation,
    {
      type: "close",
      at: new Date(),
      by: session.user.id,
      isStaff,
      reason: String(form.get("reason") ?? "").trim() || undefined,
    },
    "",
    new Date()
  );

  if (!result.ok) return { error: "That conversation is already closed." };

  await record({
    action: "conversation.closed",
    subject: { type: "conversation", id: conversationId },
    actor: { userId: session.user.id, role: session.user.roles[0] },
  });

  revalidatePath(`/conversations/${conversationId}`);
  return {};
}
