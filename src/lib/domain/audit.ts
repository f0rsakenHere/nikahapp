/* The audit log.
 *
 * docs/APP-PLAN.md §5.10 and §7.7. Append-only: no updates, no deletes,
 * ever. It is a compliance requirement and also a published product
 * feature — the wali portal promises "every action is logged with a
 * timestamp", for him as well as for us.
 *
 * Built now rather than later on purpose. An audit log added after the
 * fact records only what happened after it was added, and the entries
 * you want most are always the ones from before.
 *
 * Actions are a closed list. A free-text action field turns into forty
 * spellings of the same event and a log nobody can query — and the whole
 * point of this collection is being able to answer "who read her legal
 * name, and when" two years later.
 */
import { z } from "zod";

export const AUDIT_ACTIONS = [
  /* account */
  "account.registered",
  "account.signedIn",
  "account.signInFailed",
  "account.signedOut",
  "account.passwordChanged",
  "account.passwordReset",
  "account.emailVerified",
  "account.sessionRevoked",
  "account.mfaEnabled",
  "account.mfaChallengeFailed",
  "account.dataExported",
  "account.erased",

  /* profile */
  "profile.submitted",
  "profile.approved",
  "profile.rejected",
  "profile.paused",
  "profile.resumed",
  "profile.withdrawn",

  /* connections (§3.1 D1) */
  "connection.requested",
  "connection.accepted",
  "connection.declined",

  /* conversations */
  "conversation.opened",
  "conversation.waliApproved",
  "conversation.waliDeclined",
  "conversation.closed",
  "conversation.messageSent",
  "staff.readConversation",

  /* the wali */
  "guardianship.invited",
  "guardianship.confirmed",
  "guardianship.declined",
  "guardianship.revoked",
  "guardianship.replaced",
  /* Separate from `confirmed` on purpose: "she named the service as her
     wali" is a different fact from "a relative accepted", and a year
     from now somebody will need to count the first without the second. */
  "guardianship.moderatorAppointed",

  /* staff — every one of these touches somebody's private information */
  "staff.viewedIdentityDocuments",
  "staff.viewedLegalName",
  "staff.notedMember",
  "staff.impersonationStarted",
  "staff.impersonationEnded",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_SUBJECTS = [
  "user",
  "profile",
  "guardianship",
  "session",
  "verification",
  "connectionRequest",
  "conversation",
] as const;

export type AuditSubjectType = (typeof AUDIT_SUBJECTS)[number];

export const AuditEntrySchema = z.object({
  at: z.date(),

  actor: z.object({
    /* Null for something the system did on its own — an expiry sweep, a
     * scheduled reminder. Not "unknown": if a person did it, we know
     * who, and if nobody did, that is the honest record. */
    userId: z.string().min(1).nullable(),
    role: z.string().min(1).nullable(),
    ip: z.string().nullable(),
    userAgent: z.string().nullable(),
    /* §7.8: mandatory whenever staff act through "view as member". An
     * action taken during impersonation that does not carry this is
     * indistinguishable from the member doing it themselves, which is
     * the one thing the feature must never allow. */
    impersonatedBy: z.string().min(1).nullable(),
  }),

  action: z.enum(AUDIT_ACTIONS),
  subject: z.object({ type: z.enum(AUDIT_SUBJECTS), id: z.string().min(1) }),

  /* Deliberately loose in shape and strict in content — see
   * `assertNoSecrets`. A log that quotes the thing it is protecting is
   * worse than no log. */
  meta: z.record(z.string(), z.unknown()).default({}),
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

/* Keys that must never appear in `meta`. The audit log is read by staff,
 * exported for compliance and retained for years — putting a password
 * hash, a session token or a reset link in it would quietly turn the
 * safest collection into the most dangerous one. */
const FORBIDDEN_META_KEYS = [
  "password",
  "passwordhash",
  "token",
  "tokenhash",
  "secret",
  "link",
  "otp",
  "code",
];

export type SecretLeak = { key: string; reason: "forbidden-key" | "looks-like-a-secret" };

/** Anything in `meta` that should not be written down.
 *
 *  Checks the key names, and also the values: a 43-character base64url
 *  string under an innocent key is a token whatever it is called. */
export function findSecrets(meta: Record<string, unknown>, path = ""): SecretLeak[] {
  const leaks: SecretLeak[] = [];

  for (const [key, value] of Object.entries(meta)) {
    const here = path ? `${path}.${key}` : key;
    const normalised = key.toLowerCase().replace(/[^a-z]/g, "");

    if (FORBIDDEN_META_KEYS.some((f) => normalised.includes(f))) {
      leaks.push({ key: here, reason: "forbidden-key" });
      continue;
    }

    if (typeof value === "string") {
      /* 32 bytes, base64url — the shape of every token in this codebase.
       * Also catches a hex digest of 40 characters or more. */
      if (/^[A-Za-z0-9_-]{43}$/.test(value) || /^[0-9a-f]{40,}$/.test(value)) {
        leaks.push({ key: here, reason: "looks-like-a-secret" });
      }
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      leaks.push(...findSecrets(value as Record<string, unknown>, here));
    }
  }

  return leaks;
}

/** Which actions a wali may see about his own ward (§7.7: "expose a
 *  filtered view to the wali"). Everything else is staff-only. */
const WALI_VISIBLE: ReadonlySet<AuditAction> = new Set([
  "guardianship.invited",
  "guardianship.confirmed",
  "guardianship.declined",
  "guardianship.revoked",
  "guardianship.replaced",
  "guardianship.moderatorAppointed",
  "profile.submitted",
  "profile.approved",
  "profile.rejected",
]);

export function visibleToWali(action: AuditAction): boolean {
  return WALI_VISIBLE.has(action);
}
