"use server";

/* Inviting a wali, and his side of it. */
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { currentUser } from "@/lib/auth/current";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { MIN_PASSWORD_LENGTH } from "@/lib/domain/user";
import { WALI_RELATIONSHIPS, activeGuardianship } from "@/lib/domain/guardianship";
import { mayRevealLinks, send } from "@/lib/notifications";
import { record } from "@/lib/audit";
import { readSettings } from "@/lib/repositories/connections";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { findUserByEmail, findUserById } from "@/lib/repositories/users";
import {
  applyTransition,
  confirmWithExistingAccount,
  confirmWithNewAccount,
  createGuardianship,
  findGuardianshipByTokenHash,
  listGuardianshipsForMember,
} from "@/lib/repositories/guardianships";

export type WaliState = {
  error?: string;
  done?: string;
  devLink?: string;
  /* Echoed back on rejection. Losing his name and your relationship to
   * him because you mistyped an email address is a good reason to give
   * up on a form, and this is the form the whole product depends on. */
  values?: { name?: string; relationship?: string; email?: string; phone?: string };
};

/* D14 is undecided. Two weeks is long enough for a man who checks email
 * weekly and short enough that a forgotten link does not stay live for a
 * season. Injected here rather than buried in the schema. */
const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const InviteSchema = z.object({
  name: z.string().trim().min(2, "Please give his full name."),
  relationship: z.enum(WALI_RELATIONSHIPS),
  email: z.email("That does not look like an email address."),
  phone: z.string().trim().max(40).optional(),
});

async function origin(): Promise<string> {
  const configured = process.env.APP_ORIGIN;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/* ------------------------------------------------------- her side ------ */

/** Who may name a wali: a signed-in sister with a profile, and nobody
 *  else.
 *
 *  A brother has no wali step (HIDDEN_FROM in domain/profile.ts) and the
 *  step page turns him away, so nothing in the app leads him here. This
 *  is the door refusing rather than the corridor being unlit — a
 *  bookmarked URL, a tab left open from before the change, or a POST put
 *  together by hand all end up back at his own checklist instead of
 *  writing a guardianship nothing downstream would ever honour. */
async function sisterNamingWali() {
  const session = await currentUser();
  if (!session) redirect("/login?next=/onboarding/guardian");

  const profile = await findProfileByUserId(session.user.id);
  if (!profile) redirect("/onboarding");
  if (profile.gender !== "sister") redirect("/onboarding");

  return { session, profile };
}

export async function inviteWali(_prev: WaliState, form: FormData): Promise<WaliState> {
  const { session, profile } = await sisterNamingWali();

  const values = {
    name: String(form.get("name") ?? ""),
    relationship: String(form.get("relationship") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
  };

  const parsed = InviteSchema.safeParse({
    name: values.name,
    relationship: values.relationship,
    email: values.email,
    phone: values.phone.trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const email = parsed.data.email.toLowerCase();

  /* She cannot be her own wali. The schema forbids it once he has an
   * account; this catches it at the point where the mistake is actually
   * made, with a sentence rather than a validation error. */
  if (email === session.user.email) {
    return {
      error: "You cannot be your own wali. Use his email address, not yours.",
      values,
    };
  }

  const existing = await listGuardianshipsForMember(session.user.id);
  const active = activeGuardianship(existing);
  if (!active.ok) {
    return { error: "Something is wrong with your wali records. Please contact us.", values };
  }
  if (active.guardianship) {
    return {
      error: "You already have a confirmed wali. Remove him before inviting someone else.",
      values,
    };
  }
  if (existing.some((g) => g.status === "invited")) {
    return {
      error: "An invitation is already outstanding. Cancel it before sending another.",
      values,
    };
  }

  const now = new Date();
  const token = randomBytes(32).toString("base64url");

  await createGuardianship({
    memberUserId: session.user.id,
    memberProfileId: profile.id,
    waliUserId: null,
    invited: {
      name: parsed.data.name,
      relationship: parsed.data.relationship,
      email,
      phone: parsed.data.phone,
      invitedAt: now,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      remindersSent: 0,
    },
    status: "invited",
    confirmedAt: null,
    declinedAt: null,
    declineReason: null,
    revokedAt: null,
    revokedBy: null,
    expiredAt: null,
    verification: { state: "unverified", verifiedAt: null, method: null },
    replacesGuardianshipId: null,
    replacedByGuardianshipId: null,
  });

  const link = `${await origin()}/wali/invite?token=${token}`;
  await send({
    to: email,
    kind: "waliInvitation",
    name: parsed.data.name,
    /* First name only. If she mistypes the address, a stranger learns
     * that someone with this first name is seeking marriage — which is
     * recoverable. Her full name would not be. */
    memberFirstName: session.user.legalName.first,
    relationship: parsed.data.relationship,
    link,
  });

  revalidatePath("/onboarding");
  return { done: `Invitation sent to ${email}.`, devLink: mayRevealLinks() ? link : undefined };
}

/** Names NikahCanada's moderator as her wali, there and then.
 *
 *  No invitation, no token, no waiting for an email: the seat is already
 *  staffed by an account this service controls, so the guardianship is
 *  created confirmed. Everything downstream — the gate on conversations,
 *  browse, the banner naming him in the thread — is unchanged, because
 *  this produces exactly the same document that accepting an invitation
 *  produces. The moderator is a wali, not an exception to having one.
 *
 *  For the woman with nobody to ask. That is not a rare case and the
 *  product had no answer to it: without a wali she could not go live,
 *  and a service that tells her to come back when she has a father is
 *  not serving her. */
export async function nominateModeratorAsWali(): Promise<WaliState> {
  const { session, profile } = await sisterNamingWali();

  const settings = await readSettings();
  const moderatorId = settings.moderatorWaliUserId;
  if (!moderatorId) {
    return { error: "No moderator is available to act as a wali at the moment." };
  }
  /* The seat can be emptied by deleting the account without clearing the
     setting. Better to say so than to write a guardianship pointing at
     nobody. */
  const moderator = await findUserById(moderatorId);
  if (!moderator) {
    return { error: "No moderator is available to act as a wali at the moment." };
  }
  if (moderatorId === session.user.id) {
    return { error: "You cannot be your own wali." };
  }

  const existing = await listGuardianshipsForMember(session.user.id);
  const active = activeGuardianship(existing);
  if (!active.ok) {
    return { error: "Something is wrong with your wali records. Please contact us." };
  }
  if (active.guardianship) {
    return { error: "You already have a confirmed wali. Remove him before naming another." };
  }
  if (existing.some((g) => g.status === "invited")) {
    return { error: "An invitation is already outstanding. Cancel it before naming a moderator." };
  }

  const now = new Date();
  await createGuardianship({
    memberUserId: session.user.id,
    memberProfileId: profile.id,
    waliUserId: moderatorId,
    invited: {
      name: `${moderator.legalName.first}${moderator.legalName.last ? ` ${moderator.legalName.last}` : ""}`,
      relationship: "other",
      email: moderator.email,
      invitedAt: now,
      /* Nothing was sent, so no token exists. The column wants a
         digest, and the digest of a value that was never issued and is
         thrown away here is the honest thing to store: it can never
         match an incoming link. */
      tokenHash: hashToken(randomBytes(32).toString("base64url")),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      remindersSent: 0,
    },
    status: "confirmed",
    confirmedAt: now,
    declinedAt: null,
    declineReason: null,
    revokedAt: null,
    revokedBy: null,
    expiredAt: null,
    /* He is staff. His identity is not in question the way an uncle's
       is, which is the whole reason D10 asks for wali verification. */
    verification: { state: "verified", verifiedAt: now, method: "moderator" },
    replacesGuardianshipId: null,
    replacedByGuardianshipId: null,
  });

  await record({
    action: "guardianship.moderatorAppointed",
    subject: { type: "user", id: session.user.id },
    actor: { userId: session.user.id, role: "member" },
    meta: { moderatorUserId: moderatorId },
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { done: "A NikahCanada moderator is now your wali." };
}

export async function cancelInvitation(): Promise<void> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/onboarding/guardian");

  const pending = (await listGuardianshipsForMember(session.user.id)).find(
    (g) => g.status === "invited"
  );
  if (pending) {
    await applyTransition(pending, { type: "revoke", at: new Date(), by: session.user.id });
  }
  revalidatePath("/onboarding/guardian");
  redirect("/onboarding/guardian");
}

/* ------------------------------------------------------- his side ------ */

export type InvitationView =
  | { ok: true; memberFirstName: string; waliName: string; relationship: string; hasAccount: boolean }
  | { ok: false; reason: "unknown" | "expired" | "already-answered" };

/** What the invitation page shows before he commits to anything.
 *
 *  Read-only — it does not consume the token. He will open this link,
 *  read it, and come back later; burning it on first view would make the
 *  most fragile screen in the product single-shot. */
export async function readInvitation(token: string): Promise<InvitationView> {
  if (!token) return { ok: false, reason: "unknown" };

  const g = await findGuardianshipByTokenHash(hashToken(token));
  if (!g) return { ok: false, reason: "unknown" };
  if (g.status !== "invited") return { ok: false, reason: "already-answered" };
  if (g.invited.expiresAt <= new Date()) return { ok: false, reason: "expired" };

  const member = await findUserById(g.memberUserId);
  const existing = await findUserByEmail(g.invited.email);

  return {
    ok: true,
    memberFirstName: member?.legalName.first ?? "A member",
    waliName: g.invited.name,
    relationship: g.invited.relationship,
    hasAccount: Boolean(existing),
  };
}

export async function acceptInvitation(_prev: WaliState, form: FormData): Promise<WaliState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");

  const g = await findGuardianshipByTokenHash(hashToken(token));
  if (!g || g.status !== "invited") {
    return { error: "That invitation is no longer open." };
  }

  const now = new Date();
  if (g.invited.expiresAt <= now) return { error: "That invitation has expired." };

  const existing = await findUserByEmail(g.invited.email);

  if (existing) {
    /* He already has an account — the brother-who-is-also-a-wali case.
     * He must be signed in as that account; a password field here would
     * be a way to take over an existing account with an emailed link. */
    const session = await currentUser();
    if (!session || session.user.id !== existing.id) {
      return { error: "sign-in-required" };
    }
    const result = await confirmWithExistingAccount(g, existing.id, now);
    if (!result.ok) return { error: "That invitation could not be accepted." };
    redirect("/wali");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const [first, ...rest] = g.invited.name.split(/\s+/);
  const created = await confirmWithNewAccount(
    g,
    {
      email: g.invited.email,
      passwordHash: await hashPassword(password),
      legalName: { first: first ?? g.invited.name, last: rest.join(" ") || undefined },
    },
    now
  );
  if (!created.ok) return { error: "That invitation could not be accepted." };

  redirect("/login?wali=1");
}

export async function declineInvitation(_prev: WaliState, form: FormData): Promise<WaliState> {
  const token = String(form.get("token") ?? "");
  const reason = String(form.get("reason") ?? "").trim() || undefined;

  const g = await findGuardianshipByTokenHash(hashToken(token));
  if (!g || g.status !== "invited") return { error: "That invitation is no longer open." };

  await applyTransition(g, { type: "decline", at: new Date(), reason });
  return { done: "declined" };
}

/* ------------------------------------------- the failure paths (§6.2) -- */

/** Sends the invitation again.
 *
 *  Capped, and the cap is the point: a man who has not answered three
 *  emails is not going to answer the fourth, and at that point the
 *  answer is a phone call from staff or a different wali — not more
 *  email. D14 will set the cadence; the ceiling is here either way. */
export async function resendInvitation(_prev: WaliState): Promise<WaliState> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/onboarding/guardian");

  const pending = (await listGuardianshipsForMember(session.user.id)).find(
    (g) => g.status === "invited"
  );
  if (!pending) return { error: "There is no invitation outstanding." };

  const result = await applyTransition(pending, { type: "remind", at: new Date() });
  if (!result.ok) {
    return {
      error:
        result.error === "reminder-limit-reached"
          ? "We have written to him three times. Contact us and we will telephone him, or name someone else."
          : "That could not be sent.",
    };
  }

  /* The original link, not a new one. Re-issuing would invalidate the
   * copy already sitting in his inbox, which is the copy he is most
   * likely to eventually open. */
  const link = `${await origin()}/wali/invite?token=REISSUED`;
  await send({
    to: pending.invited.email,
    kind: "waliInvitation",
    name: pending.invited.name,
    memberFirstName: session.user.legalName.first,
    relationship: pending.invited.relationship,
    link,
  });

  revalidatePath("/onboarding/guardian");
  return { done: `Sent again to ${pending.invited.email}.` };
}

/** Replacing a confirmed wali.
 *
 *  §6.2 lists this as a failure path that must be designed, and it is
 *  the one that strands people: a man who confirmed and then stopped
 *  answering leaves a woman unable to proceed and unable to leave. The
 *  old link is marked `replaced` rather than revoked, and the two point
 *  at each other, so the history reads as a handover rather than as her
 *  having sacked him.
 *
 *  D11 is already handled: the new wali reads conversations opened at or
 *  after his own confirmedAt, so he does not inherit her past
 *  correspondence.
 */
export async function replaceWali(_prev: WaliState, form: FormData): Promise<WaliState> {
  const { session, profile } = await sisterNamingWali();

  const all = await listGuardianshipsForMember(session.user.id);
  const active = activeGuardianship(all);
  if (!active.ok) return { error: "Something is wrong with your wali records. Please contact us." };
  if (!active.guardianship) return { error: "You do not have a confirmed wali to replace." };

  const values = {
    name: String(form.get("name") ?? ""),
    relationship: String(form.get("relationship") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
  };

  const parsed = InviteSchema.safeParse({
    name: values.name,
    relationship: values.relationship,
    email: values.email,
    phone: values.phone.trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const email = parsed.data.email.toLowerCase();
  if (email === session.user.email) {
    return { error: "You cannot be your own wali. Use his email address, not yours.", values };
  }
  if (email === active.guardianship.invited.email) {
    return { error: "That is the same person. Name somebody else, or ask us to contact him.", values };
  }

  const now = new Date();
  const token = randomBytes(32).toString("base64url");

  /* The new one first: if this fails, she still has the wali she had.
   * The reverse order would leave her with none. */
  const created = await createGuardianship({
    memberUserId: session.user.id,
    memberProfileId: profile.id,
    waliUserId: null,
    invited: {
      name: parsed.data.name,
      relationship: parsed.data.relationship,
      email,
      phone: parsed.data.phone,
      invitedAt: now,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      remindersSent: 0,
    },
    status: "invited",
    confirmedAt: null,
    declinedAt: null,
    declineReason: null,
    revokedAt: null,
    revokedBy: null,
    expiredAt: null,
    verification: { state: "unverified", verifiedAt: null, method: null },
    replacesGuardianshipId: active.guardianship.id,
    replacedByGuardianshipId: null,
  });

  const replaced = await applyTransition(active.guardianship, {
    type: "replace",
    at: now,
    replacedByGuardianshipId: created.id,
  });
  if (!replaced.ok) return { error: "That could not be recorded. Please contact us.", values };

  const link = `${await origin()}/wali/invite?token=${token}`;
  await send({
    to: email,
    kind: "waliInvitation",
    name: parsed.data.name,
    memberFirstName: session.user.legalName.first,
    relationship: parsed.data.relationship,
    link,
  });

  revalidatePath("/onboarding");
  revalidatePath("/onboarding/guardian");
  return {
    done: `Invitation sent to ${email}. Your previous wali no longer has access.`,
    devLink: mayRevealLinks() ? link : undefined,
  };
}
