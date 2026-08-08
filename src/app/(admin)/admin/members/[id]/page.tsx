import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/actions";
import { historyFor } from "@/lib/audit";
import { can } from "@/lib/domain/authorisation";
import { completeness, submitBlockers, stepsFor } from "@/lib/domain/profile";
import {
  CHILDREN_LABELS,
  CITIZENSHIP_LABELS,
  EDUCATION_LABELS,
  MADHHAB_LABELS,
  MARITAL_STATUS_LABELS,
  PROVINCE_LABELS,
  SALAH_LABELS,
} from "@/lib/domain/profile-labels";
import { findProfileById } from "@/lib/repositories/profiles";
import { findUserById } from "@/lib/repositories/users";
import { listGuardianshipsForMember } from "@/lib/repositories/guardianships";
import { AdminShell } from "../../../shell";
import { DecisionForm } from "./decision";
import { ChecksPanel } from "./checks";
import { listVerificationsFor } from "@/lib/repositories/verifications";
import { verificationGaps } from "@/lib/domain/verification";

export const metadata: Metadata = { title: "Member — NikahCanada staff" };

const date = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(d) : "—";

function Row({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <div className="flex justify-between gap-6 border-b border-soft-green/70 py-2">
      <span className="text-[12px] uppercase tracking-[0.6px] text-text/60">{label}</span>
      <span className="text-right text-[13px] text-black">{value ?? "—"}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-soft-green p-4">
      <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.6px] text-text/70">
        {title}
      </h2>
      {children}
    </section>
  );
}

/* Everything about one person on one screen — the "member 360" of §8.3.
 *
 * What it deliberately does NOT show is the legal name. Reading one is
 * an audited event (§7.7), a matchmaker does not hold that permission at
 * all, and nothing on this page needs it to decide whether a profile is
 * ready. It is the verifier's screen that will spend that read.
 */
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user: staffUser } = await requireStaff();

  const profile = await findProfileById(id);
  if (!profile) notFound();

  const member = await findUserById(profile.userId);
  const guardianships = await listGuardianshipsForMember(profile.userId);
  const confirmed = guardianships.find((g) => g.status === "confirmed") ?? null;
  const outstanding = guardianships.find((g) => g.status === "invited") ?? null;

  const ctx = { hasConfirmedWali: Boolean(confirmed) };
  const blockers = submitBlockers(profile, ctx);
  const progress = completeness(profile, ctx);
  const history = await historyFor({ type: "profile", id });
  const verifications = await listVerificationsFor(profile.userId);
  const gaps = verificationGaps(profile.gender, verifications);

  const mayDecide = can(
    { userId: staffUser.id, roles: staffUser.roles },
    "profile.decide",
    { type: "member", memberUserId: profile.userId }
  ).allowed;

  return (
    <AdminShell
      title={`${profile.initials ?? "—"} · ${profile.gender === "sister" ? "Sister" : "Brother"}`}
      subtitle={`${profile.status} · ${progress.percent}% complete · ${stepsFor(profile.gender).length} steps`}
      user={staffUser}
      back={{ href: "/admin", label: "Back to the queue" }}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Basics">
          <Row label="Born" value={profile.basics.birthYear} />
          <Row label="City" value={profile.basics.city} />
          <Row
            label="Province"
            value={profile.basics.province ? PROVINCE_LABELS[profile.basics.province] : undefined}
          />
          <Row
            label="Status in Canada"
            value={profile.basics.citizenship ? CITIZENSHIP_LABELS[profile.basics.citizenship] : undefined}
          />
          <Row label="Height" value={profile.basics.heightCm ? `${profile.basics.heightCm} cm` : undefined} />
        </Section>

        <Section title="Background">
          <Row
            label="Marital status"
            value={profile.background.maritalStatus ? MARITAL_STATUS_LABELS[profile.background.maritalStatus] : undefined}
          />
          <Row
            label="Children"
            value={profile.background.children ? CHILDREN_LABELS[profile.background.children] : undefined}
          />
          <Row label="Languages" value={profile.background.languages.join(", ") || undefined} />
          <Row label="Ethnic background" value={profile.background.ethnicity} />
          <Row
            label="Education"
            value={profile.education.level ? EDUCATION_LABELS[profile.education.level] : undefined}
          />
          <Row label="Work" value={profile.work.occupation} />
        </Section>

        <Section title="Deen">
          <Row label="Salah" value={profile.deen.salah ? SALAH_LABELS[profile.deen.salah] : undefined} />
          <Row
            label="Madhhab"
            value={profile.deen.madhhab ? MADHHAB_LABELS[profile.deen.madhhab] : undefined}
          />
          <Row label={profile.gender === "sister" ? "Dress" : "Beard"} value={profile.deen.dress ?? profile.deen.beard} />
        </Section>

        <Section title={profile.gender === "sister" ? "Her wali" : "His reference"}>
          {profile.gender === "sister" ? (
            confirmed ? (
              <>
                <Row label="Name" value={confirmed.invited.name} />
                <Row label="Relationship" value={confirmed.invited.relationship} />
                <Row label="Email" value={confirmed.invited.email} />
                <Row label="Confirmed" value={date(confirmed.confirmedAt)} />
                <Row label="Identity checked" value={confirmed.verification.state} />
              </>
            ) : outstanding ? (
              <p className="text-[13px] leading-[20px] text-peach-deep">
                Invited {date(outstanding.invited.invitedAt)} to {outstanding.invited.email}. Not
                confirmed — her profile cannot go live.
              </p>
            ) : (
              <p className="text-[13px] text-peach-deep">No wali named.</p>
            )
          ) : (
            <>
              <Row label="Name" value={profile.reference.name} />
              <Row label="How they know him" value={profile.reference.relationship} />
              <Row label="Where" value={profile.reference.organisation} />
              <Row label="Phone" value={profile.reference.phone} />
            </>
          )}
        </Section>

        <Section title="In their own words">
          <p className="whitespace-pre-wrap text-[13px] leading-[21px] text-black">
            {profile.freeText.aboutMe || "—"}
          </p>
        </Section>

        <Section title="What they are looking for">
          <Row
            label="Age"
            value={
              profile.lookingFor.ageMin && profile.lookingFor.ageMax
                ? `${profile.lookingFor.ageMin}–${profile.lookingFor.ageMax}`
                : undefined
            }
          />
          <Row
            label="Provinces"
            value={profile.lookingFor.provinces.map((p) => PROVINCE_LABELS[p]).join(", ") || undefined}
          />
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-[21px] text-black">
            {profile.lookingFor.freeText || ""}
          </p>
        </Section>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Section title="Account">
          {/* The profile is created in the same transaction as the
              account, so its createdAt is the registration time. */}
          <Row label="Registered" value={date(profile.createdAt)} />
          <Row label="Email confirmed" value={member?.emailVerifiedAt ? date(member.emailVerifiedAt) : "not yet"} />
          <Row label="Last signed in" value={date(member?.lastLoginAt)} />
          <Row label="Submitted" value={date(profile.updatedAt)} />
        </Section>

        <Section title="History">
          {history.length === 0 ? (
            <p className="text-[13px] text-text/70">Nothing recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {history.slice(0, 12).map((e, i) => (
                <li key={i} className="flex justify-between gap-4 text-[12px]">
                  <span className="text-black">{e.action}</span>
                  <span className="text-text/60">{date(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="mt-6">
        <Section title="Checks">
          <ChecksPanel
            verifications={verifications}
            guardianship={
              profile.gender === "sister" && confirmed
                ? {
                    id: confirmed.id,
                    name: `${confirmed.invited.name} · ${confirmed.invited.relationship}`,
                    verified: confirmed.verification.state === "verified",
                  }
                : null
            }
          />
        </Section>
      </div>

      <div className="mt-6">
        <Section title="Decision">
          {blockers.length ? (
            <p className="mb-3 text-[13px] leading-[20px] text-peach-deep">
              Not ready:{" "}
              {blockers
                .map((b) => (b.reason === "wali-not-confirmed" ? "wali has not confirmed" : `${b.step} unfinished`))
                .join(" · ")}
            </p>
          ) : null}

          {gaps.length ? (
            <p className="mb-3 text-[13px] leading-[20px] text-peach-deep">
              Checks outstanding: {gaps.map((g) => `${g.kind} (${g.reason})`).join(" · ")}
            </p>
          ) : null}

          {mayDecide ? (
            <DecisionForm profileId={id} blocked={blockers.length > 0 || gaps.length > 0} status={profile.status} />
          ) : (
            <p className="text-[13px] text-text">
              Your account can read this profile but not decide on it.
            </p>
          )}
        </Section>
      </div>
    </AdminShell>
  );
}
