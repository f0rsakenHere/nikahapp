/* The negative cases matter more than the positive ones here (§7.2),
 * so most of this file is about what must be refused. */
import { describe, expect, it } from "vitest";
import { ACTIONS, can, isStaffActor, type Action, type Actor, type Subject } from "./authorisation";
import { ROLES, type Role } from "./user";

const member: Actor = { userId: "m1", roles: ["member"] };
const wali: Actor = { userId: "w1", roles: ["wali"] };
const staff: Actor = { userId: "s1", roles: ["staff"] };
const verifier: Actor = { userId: "v1", roles: ["verifier"] };
const admin: Actor = { userId: "a1", roles: ["admin"] };

const SYSTEM: Subject = { type: "system" };
const HER: Subject = { type: "member", memberUserId: "m1" };
const SOMEONE_ELSE: Subject = { type: "member", memberUserId: "m2" };
const HIS_WARD: Subject = {
  type: "ward",
  memberUserId: "m1",
  waliUserId: "w1",
  confirmed: true,
};

describe("the default is no", () => {
  it("refuses an action nobody granted to a member", () => {
    for (const action of ACTIONS) {
      if (action.startsWith("self.")) continue;
      expect(can(member, action, SYSTEM).allowed).toBe(false);
    }
  });

  it("refuses every role an action it was not granted", () => {
    /* If a new action is added to ACTIONS and to nobody's grants, this
       keeps passing — which is the point: absent means refused. */
    for (const role of ROLES) {
      const actor: Actor = { userId: "x", roles: [role as Role] };
      for (const action of ACTIONS) {
        const decision = can(actor, action, SYSTEM);
        if (!decision.allowed) expect(decision.reason).toBeDefined();
      }
    }
  });
});

describe("a member, about themselves", () => {
  it("may read and edit their own profile", () => {
    expect(can(member, "self.readProfile", HER).allowed).toBe(true);
    expect(can(member, "self.editProfile", HER).allowed).toBe(true);
    expect(can(member, "self.submitProfile", HER).allowed).toBe(true);
  });

  it("may not touch anybody else's", () => {
    const decision = can(member, "self.editProfile", SOMEONE_ELSE);
    expect(decision.allowed).toBe(false);
    expect(!decision.allowed && decision.reason).toBe("not-your-own");
  });

  it("cannot read the staff queue or anyone's documents", () => {
    expect(can(member, "queue.read", SYSTEM).allowed).toBe(false);
    expect(can(member, "member.readIdentityDocuments", SOMEONE_ELSE).allowed).toBe(false);
    expect(can(member, "profile.decide", SOMEONE_ELSE).allowed).toBe(false);
  });
});

describe("a wali — the catastrophic cases", () => {
  it("may read and act for his own confirmed ward", () => {
    expect(can(wali, "ward.read", HIS_WARD).allowed).toBe(true);
    expect(can(wali, "ward.readConversation", HIS_WARD).allowed).toBe(true);
    expect(can(wali, "ward.approveIntroduction", HIS_WARD).allowed).toBe(true);
  });

  it("may not read another family's ward", () => {
    const other: Subject = { ...HIS_WARD, waliUserId: "w2" };
    const decision = can(wali, "ward.readConversation", other);
    expect(decision.allowed).toBe(false);
    expect(!decision.allowed && decision.reason).toBe("not-your-ward");
  });

  it("may not act on a guardianship that is not confirmed", () => {
    const pending: Subject = { ...HIS_WARD, confirmed: false };
    const decision = can(wali, "ward.readConversation", pending);
    expect(decision.allowed).toBe(false);
    expect(!decision.allowed && decision.reason).toBe("guardianship-not-confirmed");
  });

  it("may not act on a guardianship with no wali attached at all", () => {
    const orphan: Subject = { ...HIS_WARD, waliUserId: null };
    expect(can(wali, "ward.read", orphan).allowed).toBe(false);
  });

  it("gets nothing from a subject that is not a ward", () => {
    expect(can(wali, "ward.read", HER).allowed).toBe(false);
    expect(can(wali, "ward.read", SYSTEM).allowed).toBe(false);
  });

  it("cannot read the staff queue or decide on profiles", () => {
    expect(can(wali, "queue.read", SYSTEM).allowed).toBe(false);
    expect(can(wali, "profile.decide", SOMEONE_ELSE).allowed).toBe(false);
    expect(can(wali, "member.readIdentityDocuments", HIS_WARD).allowed).toBe(false);
  });
});

describe("the two staff roles are not the same role", () => {
  it("a matchmaker reads the queue and decides, and sees no documents", () => {
    expect(can(staff, "queue.read", SYSTEM).allowed).toBe(true);
    expect(can(staff, "profile.decide", SOMEONE_ELSE).allowed).toBe(true);
    expect(can(staff, "member.readIdentityDocuments", SOMEONE_ELSE).allowed).toBe(false);
    expect(can(staff, "member.readLegalName", SOMEONE_ELSE).allowed).toBe(false);
  });

  it("a verifier reads documents and does not decide on profiles", () => {
    expect(can(verifier, "member.readIdentityDocuments", SOMEONE_ELSE).allowed).toBe(true);
    expect(can(verifier, "member.readLegalName", SOMEONE_ELSE).allowed).toBe(true);
    expect(can(verifier, "profile.decide", SOMEONE_ELSE).allowed).toBe(false);
  });

  it("neither can manage staff", () => {
    expect(can(staff, "staff.manage", SYSTEM).allowed).toBe(false);
    expect(can(verifier, "staff.manage", SYSTEM).allowed).toBe(false);
    expect(can(admin, "staff.manage", SYSTEM).allowed).toBe(true);
  });
});

describe("an admin", () => {
  it("holds every action", () => {
    for (const action of ACTIONS) {
      if (action.startsWith("self.") || action.startsWith("ward.")) continue;
      expect(can(admin, action, SYSTEM).allowed).toBe(true);
    }
  });

  it("is still not anybody's wali", () => {
    /* Holding the permission is not the same as holding the role over
       this family. An admin who wants to read a conversation does it as
       staff oversight, which is logged as such. */
    const notHis: Subject = { ...HIS_WARD, waliUserId: "w1" };
    expect(can(admin, "ward.readConversation", notHis).allowed).toBe(false);
  });

  it("is still not the member", () => {
    expect(can(admin, "self.editProfile", SOMEONE_ELSE).allowed).toBe(false);
  });
});

describe("impersonation is read-only (§7.8)", () => {
  const viewing: Actor = { ...staff, impersonating: true };

  it("still allows reading", () => {
    expect(can(viewing, "queue.read", SYSTEM).allowed).toBe(true);
    expect(can(viewing, "profile.readAny", SOMEONE_ELSE).allowed).toBe(true);
  });

  it("refuses every mutation", () => {
    for (const action of ["profile.decide", "member.note"] as Action[]) {
      const decision = can(viewing, action, SOMEONE_ELSE);
      expect(decision.allowed).toBe(false);
      expect(!decision.allowed && decision.reason).toBe("read-only-while-impersonating");
    }
  });

  it("refuses a mutation even for an admin", () => {
    const impersonatingAdmin: Actor = { ...admin, impersonating: true };
    expect(can(impersonatingAdmin, "member.suspend", SOMEONE_ELSE).allowed).toBe(false);
  });
});

describe("isStaffActor", () => {
  it("is true for the three staff roles and nothing else", () => {
    for (const role of ROLES) {
      expect(isStaffActor([role as Role])).toBe(["staff", "verifier", "admin"].includes(role));
    }
  });

  it("is true for an account that holds a staff role among others", () => {
    expect(isStaffActor(["member", "wali", "verifier"])).toBe(true);
  });
});
