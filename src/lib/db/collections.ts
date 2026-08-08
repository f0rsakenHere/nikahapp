/* Collection names, in one place.
 *
 * A misspelled collection name is not an error in MongoDB — it is a new,
 * empty collection, and the query that reads it returns nothing at all.
 * `db.collection("profile")` looks exactly like `db.collection("profiles")`
 * in a code review and behaves like a service outage. So names are declared
 * once here and never written as a string literal anywhere else.
 *
 * These are the collections from docs/APP-PLAN.md §5. Document *shapes* are
 * not defined yet: they are Zod schemas in `src/lib/domain`, and several
 * still depend on the open decisions in §3.1. Naming them costs nothing and
 * blocks nothing.
 */
import type { Collection, Document } from "mongodb";
import { getDb } from "./client";

export const COLLECTIONS = {
  /* §5.1–5.10 — the core model */
  users: "users",
  profiles: "profiles",
  guardianships: "guardianships",
  verifications: "verifications",
  introductions: "introductions",
  conversations: "conversations",
  messages: "messages",
  payments: "payments",
  photoExchanges: "photoExchanges",
  auditLog: "auditLog",

  /* §5.11 — supporting */
  notifications: "notifications",
  reports: "reports",
  staffNotes: "staffNotes",
  outcomes: "outcomes",
  sessions: "sessions",
  idempotencyKeys: "idempotencyKeys",
  settings: "settings",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Typed handle on a collection. Only `src/lib/repositories` should call this
 *  — see §4.3: the driver is not meant to leak into route handlers. */
export async function collection<T extends Document>(
  name: CollectionName
): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}
