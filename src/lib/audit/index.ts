/* Writing to the audit log.
 *
 * §7.7: "emit from the service layer, never from components." One
 * function, called from server actions and repositories.
 *
 * It never throws. An audit write failing must not take a sign-in down
 * with it — but it must also never be silent, because a log with holes
 * in it is worse than a log you know is missing, so a failure is loud in
 * the server output.
 */
import { headers } from "next/headers";
import { ObjectId } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import { getDb } from "@/lib/db/client";
import { stripUndefined } from "@/lib/db/strip";
import {
  AuditEntrySchema,
  findSecrets,
  type AuditAction,
  type AuditEntry,
  type AuditSubjectType,
} from "@/lib/domain/audit";

export type RecordInput = {
  action: AuditAction;
  subject: { type: AuditSubjectType; id: string };
  actor?: { userId?: string | null; role?: string | null; impersonatedBy?: string | null };
  meta?: Record<string, unknown>;
};

/** Appends one entry. Fire-and-forget from the caller's point of view. */
export async function record(input: RecordInput): Promise<void> {
  try {
    const meta = input.meta ?? {};

    /* Refuse to write a secret rather than writing it and regretting it.
     * The audit log is read by staff, exported for compliance and kept
     * for years; a reset link in it turns the safest collection into the
     * most dangerous one. */
    const leaks = findSecrets(meta);
    if (leaks.length) {
      console.error(
        `AUDIT: refusing to log ${input.action} — meta contains ` +
          leaks.map((l) => `${l.key} (${l.reason})`).join(", ")
      );
      return;
    }

    /* Best effort: this is also called from places with no request. */
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      userAgent = h.get("user-agent");
    } catch {
      /* outside a request — a scheduled job, a script */
    }

    const entry: AuditEntry = AuditEntrySchema.parse({
      at: new Date(),
      actor: {
        userId: input.actor?.userId ?? null,
        role: input.actor?.role ?? null,
        ip,
        userAgent,
        impersonatedBy: input.actor?.impersonatedBy ?? null,
      },
      action: input.action,
      subject: input.subject,
      meta,
    });

    const db = await getDb();
    await db.collection(COLLECTIONS.auditLog).insertOne(stripUndefined({ _id: new ObjectId(), ...entry }));
  } catch (err) {
    /* Loud, but never fatal. A failed audit write must not stop someone
     * signing in — and must not pass unnoticed either. */
    console.error("AUDIT WRITE FAILED", input.action, err);
  }
}

/** Everything recorded about one subject, newest first. For the member
 *  360 view, and for the wali's filtered timeline. */
export async function historyFor(
  subject: { type: AuditSubjectType; id: string },
  limit = 200
): Promise<AuditEntry[]> {
  const db = await getDb();
  const docs = await db
    .collection(COLLECTIONS.auditLog)
    .find(
      { "subject.type": subject.type, "subject.id": subject.id },
      { sort: { at: -1 }, limit, projection: { _id: 0 } }
    )
    .toArray();
  return docs as unknown as AuditEntry[];
}
