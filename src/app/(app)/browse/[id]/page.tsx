import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { browseProfile } from "@/lib/repositories/browse";
import { findBetween, balanceFor, readSettings } from "@/lib/repositories/connections";
import {
  CHILDREN_LABELS,
  EDUCATION_LABELS,
  MADHHAB_LABELS,
  MARITAL_STATUS_LABELS,
  PROVINCE_LABELS,
  QURAN_LABELS,
  SALAH_LABELS,
} from "@/lib/domain/profile-labels";
import { AppFrame } from "../../frame";
import { ConnectButton } from "./connect";

export const metadata: Metadata = { title: "A profile — NikahCanada" };

const YEAR = new Date().getUTCFullYear();

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 border-b border-soft-green py-2.5">
      <span className="text-[18px] font-semibold uppercase tracking-[0.6px] text-text/60">
        {label}
      </span>
      <span className="text-[18px] leading-[26px] text-black">{value}</span>
    </div>
  );
}

export default async function BrowseProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await currentUser();
  if (!session) redirect(`/login?next=/browse/${id}`);

  /* Read before the lookup, not after: who is in the pool is a setting,
     so the lookup needs it. */
  const settings = await readSettings();
  const p = await browseProfile(session.user.id, id, settings);
  if (!p) notFound();

  const existing = await findBetween(session.user.id, String(p.userId));
  const balance = await balanceFor(session.user.id);

  const basics = (p.basics ?? {}) as Record<string, string | number>;
  const deen = (p.deen ?? {}) as Record<string, string>;
  const background = (p.background ?? {}) as Record<string, string | string[]>;
  const education = (p.education ?? {}) as Record<string, string>;
  const work = (p.work ?? {}) as Record<string, string>;
  const freeText = (p.freeText ?? {}) as Record<string, string>;
  const lookingFor = (p.lookingFor ?? {}) as Record<string, unknown>;

  return (
    <AppFrame active="browse" title={`${p.gender === "sister" ? "Sister" : "Brother"}${basics.birthYear ? ` · ${YEAR - Number(basics.birthYear)}` : ""}`}>
      <Link href="/browse" className="text-[18px] text-text underline-offset-2 hover:underline">
        ← Back to browse
      </Link>

      {/* The locked photograph, present as a frame with nothing in it.
          It states the rule far better than a line of policy would, and
          it is the same shape the initials tile uses. */}
      <div
        className="mt-5 flex flex-col items-center gap-1 border border-dashed border-soft-green bg-mist py-5 text-center"
        style={{ borderRadius: "30px 0 30px 0" }}
      >
        <span className="font-manrope text-[20px] font-bold text-peach-deep">
          {(p.initials as string) ?? "—"}
        </span>
        <span className="text-[18px] font-semibold text-black">Photograph locked</span>
        <span className="max-w-[240px] text-[18px] leading-[26px] text-text">
          Shared once a connection is accepted, and only after the wali approves.
        </span>
      </div>

      <div className="mt-5">
        <Row
          label="Where"
          value={[basics.city, basics.province ? PROVINCE_LABELS[basics.province as never] : null]
            .filter(Boolean)
            .join(", ")}
        />
        <Row label="Salah" value={deen.salah ? SALAH_LABELS[deen.salah as never] : null} />
        <Row label="Madhhab" value={deen.madhhab ? MADHHAB_LABELS[deen.madhhab as never] : null} />
        <Row label="Qur'an" value={deen.quran ? QURAN_LABELS[deen.quran as never] : null} />
        <Row
          label="Marital status"
          value={
            background.maritalStatus
              ? MARITAL_STATUS_LABELS[background.maritalStatus as never]
              : null
          }
        />
        <Row
          label="Children"
          value={background.children ? CHILDREN_LABELS[background.children as never] : null}
        />
        <Row
          label="Languages"
          value={Array.isArray(background.languages) ? background.languages.join(", ") : null}
        />
        <Row
          label="Education"
          value={education.level ? EDUCATION_LABELS[education.level as never] : null}
        />
        <Row label="Work" value={work.occupation} />
        <Row label="In their own words" value={freeText.aboutMe} />
        <Row label="What they are looking for" value={lookingFor.freeText as string} />
      </div>

      <div className="mt-6">
        <ConnectButton
          profileId={id}
          /* Narrowed here, on the server. The exact state never crosses
             to the client — see ConnectionView. */
          existing={
            !existing
              ? "none"
              : existing.state === "pending"
                ? "open"
                : existing.state === "accepted"
                  ? "accepted"
                  : "closed"
          }
          balance={balance}
          charge={settings.connectionCharge}
        />
      </div>
    </AppFrame>
  );
}
