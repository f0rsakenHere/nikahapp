/* The only module that reads or writes `users` and the profile draft
 * created alongside an account. Everything above this speaks in domain
 * types; the driver stops here (docs/APP-PLAN.md §4.3).
 */
import { ObjectId, type Filter, type WithId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb, withTransaction } from "@/lib/db/client";
import { stripUndefined } from "@/lib/db/strip";
import { deriveInitials } from "@/lib/domain/initials";
import { lockoutUntil, mfaRequired, type Role, type User } from "@/lib/domain/user";

type UserDoc = Omit<User, "id"> & { _id: ObjectId };

function toDomain(doc: WithId<UserDoc>): User {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toHexString() };
}

async function users() {
  return (await getDb()).collection<UserDoc>(COLLECTIONS.users);
}

/** Lookup for sign-in. Email is matched lowercased — the unique index is
 *  on the stored value, and the stored value is always lowercase. */
export async function findUserByEmail(email: string): Promise<User | null> {
  const doc = await (await users()).findOne({ email: email.trim().toLowerCase() } as Filter<UserDoc>);
  return doc ? toDomain(doc) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await (await users()).findOne({ _id: new ObjectId(id) });
  return doc ? toDomain(doc) : null;
}

export type CreateAccountInput = {
  gender: "brother" | "sister";
  email: string;
  passwordHash: string;
  legalName: { first: string; last?: string };
  dateOfBirth: Date;
  locale: "en-CA" | "fr-CA";
};

export type CreateAccountResult =
  | { ok: true; user: User; profileId: string }
  | { ok: false; error: "email-taken" };

/** Creates the account and its profile draft together.
 *
 *  One transaction, because an account with no profile is a member who
 *  can sign in and has nowhere to go, and a profile with no account is
 *  unreachable. §5.12 does not list this, but the same reasoning applies:
 *  partial success here is a support ticket on someone's first minute.
 *
 *  Gender lives on the profile and is immutable there (§5.2). It is set
 *  once, at this moment, and never accepted from a form again. */
export async function createMemberAccount(
  input: CreateAccountInput,
  now: Date
): Promise<CreateAccountResult> {
  const email = input.email.trim().toLowerCase();
  const roles: Role[] = ["member"];

  const userDoc: UserDoc = {
    _id: new ObjectId(),
    email,
    emailVerifiedAt: null,
    passwordHash: input.passwordHash,
    roles,
    status: "active",
    locale: input.locale,
    legalName: input.legalName,
    phone: null,
    dateOfBirth: input.dateOfBirth,
    mfa: { enabled: mfaRequired(roles), secret: null },
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    tokenVersion: 0,
    closedAt: null,
    closureReason: null,
  };

  const profileId = new ObjectId();

  try {
    await withTransaction(async (session) => {
      const db = await getDb();
      await db.collection<UserDoc>(COLLECTIONS.users).insertOne(stripUndefined(userDoc), { session });
      await db.collection(COLLECTIONS.profiles).insertOne(
        {
          _id: profileId,
          userId: userDoc._id,
          gender: input.gender,
          status: "draft",
          initials: deriveInitials({
            first: input.legalName.first,
            last: input.legalName.last,
          }),
          /* Derived, never asked for again. Sign-up already took the
           * exact date; the profile only ever needs the year, and asking
           * a second time is both a wasted question and a way for the
           * two to end up disagreeing — a member whose account says 1996
           * and whose profile says 1998 is shown the wrong age and slips
           * past the 18+ gate.
           *
           * UTC, because the date is stored as midnight UTC and a local
           * reading of it moves a 1 January birthday into the year
           * before. */
          basics: { birthYear: input.dateOfBirth.getUTCFullYear() },
          completeness: { step: 1, of: 5, percent: 0 },
          createdAt: now,
          updatedAt: now,
        },
        { session }
      );
    });
  } catch (err) {
    /* 11000 is the unique index on `email`. Reaching it means two
     * sign-ups raced, or the pre-check was stale — either way the answer
     * to the person in front of us is the same. */
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return { ok: false, error: "email-taken" };
    }
    throw err;
  }

  return { ok: true, user: toDomain(userDoc), profileId: profileId.toHexString() };
}

/** Clears the failure counter and records the sign-in. */
export async function recordSuccessfulLogin(userId: string, now: Date): Promise<void> {
  await (await users()).updateOne(
    { _id: new ObjectId(userId) },
    { $set: { lastLoginAt: now, failedLoginCount: 0, lockedUntil: null } }
  );
}

/** Increments the failure counter and applies the lockout ladder.
 *
 *  Returns the new count so the caller can log it. Note it deliberately
 *  does *not* tell the person how many attempts remain — that is a hint
 *  worth more to someone guessing than to someone who mistyped. */
export async function recordFailedLogin(userId: string, now: Date): Promise<number> {
  const updated = await (await users()).findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $inc: { failedLoginCount: 1 } },
    { returnDocument: "after" }
  );
  if (!updated) return 0;

  const until = lockoutUntil(updated.failedLoginCount, now);
  if (until) {
    await (await users()).updateOne({ _id: updated._id }, { $set: { lockedUntil: until } });
  }
  return updated.failedLoginCount;
}

/** Invalidates every session issued for this account. Used on password
 *  change, on suspension, and by "sign out everywhere". */
export async function bumpTokenVersion(userId: string): Promise<void> {
  await (await users()).updateOne({ _id: new ObjectId(userId) }, { $inc: { tokenVersion: 1 } });
}

/** Records that the address on the account has been confirmed. */
export async function markEmailVerified(userId: string, now: Date): Promise<void> {
  await (await users()).updateOne(
    { _id: new ObjectId(userId) },
    { $set: { emailVerifiedAt: now } }
  );
}

/** Replaces the password and invalidates every session issued so far.
 *
 *  The two happen together on purpose. A password is changed either
 *  because it was routine or because someone else knows it, and the
 *  second case is the one worth designing for: leaving the old sessions
 *  alive would mean the person you locked out is still signed in. */
export async function setPassword(userId: string, passwordHash: string): Promise<void> {
  await (await users()).updateOne(
    { _id: new ObjectId(userId) },
    { $set: { passwordHash, failedLoginCount: 0, lockedUntil: null }, $inc: { tokenVersion: 1 } }
  );
}
