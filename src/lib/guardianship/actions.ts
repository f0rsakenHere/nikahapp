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

export async function inviteWali(_prev: WaliState, form: FormData): Promise<WaliState> {
  const session = await currentUser();
  if (!session) redirect("/login?next=/onboarding/guardian");

  const profile = await findProfileByUserId(session.user.id);
  if (!profile) redirect("/onboarding");
  if (profile.gender !== "sister") redirect("/onboarding");

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
