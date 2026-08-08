/* Who may do what.
 *
 * §7.2: "Centralise it — a single `can(actor, action, subject)` in
 * lib/domain, called from the service layer, never re-derived in a
 * component." This is that function.
 *
 * Pure, and deliberately so: every rule here is a plain data question,
 * which means the negative cases can be enumerated. §7.2 again — "test
 * the negative cases explicitly. A wali reading another family's
 * conversation is a catastrophic bug, not a defect."
 *
 * The default is no. An action not listed for a role is refused, and
 * stays refused when a new action is added, rather than falling through
 * to permitted.
 */
import type { Role } from "./user";

export const ACTIONS = [
  /* staff */
  "queue.read",
  "profile.readAny",
  "profile.decide",
  "member.readLegalName",
  "member.readIdentityDocuments",
  "member.note",
  "member.suspend",
  "staff.manage",
  "audit.readAny",

  /* the wali */
  "ward.read",
  "ward.approveIntroduction",
  "ward.readConversation",
  "ward.closeConversation",

  /* a member, about themselves */
  "self.readProfile",
  "self.editProfile",
  "self.submitProfile",
] as const;

export type Action = (typeof ACTIONS)[number];

export type Actor = {
  userId: string;
  roles: readonly Role[];
  /** §7.8. Set while staff are viewing as a member. */
  impersonating?: boolean;
};

export type Subject =
  /** Something belonging to a member. */
  | { type: "member"; memberUserId: string }
  /** A ward, with the guardianship that supposedly links them. */
  | { type: "ward"; memberUserId: string; waliUserId: string | null; confirmed: boolean }
  /** Not about one person — a queue, the staff list. */
  | { type: "system" };

/* What each role may do, before any subject-specific check. */
const GRANTS: Record<Role, readonly Action[]> = {
  member: ["self.readProfile", "self.editProfile", "self.submitProfile"],

  wali: ["ward.read", "ward.approveIntroduction", "ward.readConversation", "ward.closeConversation"],

  /* A matchmaker works with live profiles and decides on new ones. They
   * do *not* get identity documents — that is the verifier's queue, and
   * separating them is the whole reason §2.3 lists two staff roles. */
  staff: ["queue.read", "profile.readAny", "profile.decide", "member.note", "audit.readAny"],

  /* The only role that sees identity documents and legal names. */
  verifier: [
    "queue.read",
    "profile.readAny",
    "member.readLegalName",
    "member.readIdentityDocuments",
    "member.note",
    "audit.readAny",
  ],

  admin: [...ACTIONS],
};

export type Denial =
  | "no-such-permission"
  | "not-your-own"
  | "not-your-ward"
  | "guardianship-not-confirmed"
  | "read-only-while-impersonating";

/* Anything that changes something. Staff viewing as a member may look
 * and may not touch (§7.8: "read-only"). */
const MUTATIONS: ReadonlySet<Action> = new Set([
  "profile.decide",
  "member.note",
  "member.suspend",
  "staff.manage",
  "ward.approveIntroduction",
  "ward.closeConversation",
  "self.editProfile",
  "self.submitProfile",
]);

export type Decision = { allowed: true } | { allowed: false; reason: Denial };

export function can(actor: Actor, action: Action, subject: Subject): Decision {
  const granted = actor.roles.some((role) => GRANTS[role]?.includes(action));
  if (!granted) return { allowed: false, reason: "no-such-permission" };

  if (actor.impersonating && MUTATIONS.has(action)) {
    return { allowed: false, reason: "read-only-while-impersonating" };
  }

  /* A member's own actions are about themselves and nobody else. Having
   * the permission is not the same as having it over this person. */
  if (action.startsWith("self.")) {
    if (subject.type !== "member" || subject.memberUserId !== actor.userId) {
      return { allowed: false, reason: "not-your-own" };
    }
    return { allowed: true };
  }

  if (action.startsWith("ward.")) {
    /* Admins hold every action, including the wali's. They are still not
     * anybody's wali, so the subject check applies to them too. */
    if (subject.type !== "ward") return { allowed: false, reason: "not-your-ward" };
    if (subject.waliUserId !== actor.userId) return { allowed: false, reason: "not-your-ward" };
    if (!subject.confirmed) return { allowed: false, reason: "guardianship-not-confirmed" };
    return { allowed: true };
  }

  return { allowed: true };
}

/** Convenience for guards that only care whether to continue. */
export function allowed(actor: Actor, action: Action, subject: Subject): boolean {
  return can(actor, action, subject).allowed;
}

/** Whether this account may open the staff console at all. */
export function isStaffActor(roles: readonly Role[]): boolean {
  return roles.some((r) => r === "staff" || r === "verifier" || r === "admin");
}
