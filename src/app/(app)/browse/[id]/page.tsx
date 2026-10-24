import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { browseProfile } from "@/lib/repositories/browse";
import { asksSince, findBetween, readSettings, weekAgo } from "@/lib/repositories/connections";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { planNote } from "@/lib/domain/plan";
import { feetAndInches } from "@/lib/domain/format";
import { ACTIVITY_LABELS, activityBand } from "@/lib/domain/activity";
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

export const metadata: Metadata = { title: "A profile | NikahCanada" };

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

  /* When they were last here. On the card and not on this page, which a
     tester read as the service hiding it: "some people don't really like
     wasting their time." */
  const band = activityBand(
    (p.lastActiveAt as Date | undefined) ??
      (p.liveAt as Date | undefined) ??
      (p.submittedAt as Date | undefined),
    new Date()
  );
  const activityLabel = band ? ACTIVITY_LABELS[band] : "Not here in the last month";

  const existing = await findBetween(session.user.id, String(p.userId));
  const asksLeft = Math.max(0, settings.asksPerWeek - (await asksSince(session.user.id, weekAgo(new Date()))));

  const basics = (p.basics ?? {}) as Record<string, string | number>;
  const deen = (p.deen ?? {}) as Record<string, string>;
  const background = (p.background ?? {}) as Record<string, string | string[]>;
  const education = (p.education ?? {}) as Record<string, string>;
  const work = (p.work ?? {}) as Record<string, string>;
  const freeText = (p.freeText ?? {}) as Record<string, string>;

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
          {(p.initials as string) ?? "?"}
        </span>
        <span className="text-[18px] font-semibold text-black">Photograph locked</span>
        <span className="max-w-[240px] text-[18px] leading-[26px] text-text">
          Photographs are exchanged privately, on consent, once you are both talking.
        </span>
      </div>

      {/* Their own words first. A tester: "maybe keep the introduction at
          the top" — it was under nine rows of structured facts, which is
          the part a reader skims and the part a member actually wrote. */}
      {typeof freeText.aboutMe === "string" && freeText.aboutMe.trim() ? (
        <div className="mt-5 rounded-md border border-soft-green bg-mist px-4 py-4">
          <p className="text-[18px] font-semibold uppercase tracking-[0.6px] text-text/70">
            In their own words
          </p>
          <p className="mt-2 whitespace-pre-wrap text-[18px] leading-[26px] text-black">
            {freeText.aboutMe}
          </p>
        </div>
      ) : null}

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
        <Row label="Ethnic background" value={(background.ethnicity as string | undefined)?.trim() || null} />
        <Row
          label="Education"
          value={education.level ? EDUCATION_LABELS[education.level as never] : null}
        />
        <Row label="Work" value={work.occupation} />
        {/* These three were on the card and missing from the page it
            opens, which a tester noticed and read as the service having
            dropped them. */}
        <Row
          label="Height"
          value={typeof basics.heightCm === "number" ? feetAndInches(basics.heightCm) : null}
        />
        <Row
          label="Would relocate"
          value={
            basics.willingToRelocate === "yes"
              ? "Yes"
              : basics.willingToRelocate === "maybe"
                ? "Maybe"
                : basics.willingToRelocate === "no"
                  ? "No"
                  : null
          }
        />
        <Row label="Last here" value={activityLabel} />
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
          asksLeft={asksLeft}
          planNote={planNote(
            (await findProfileByUserId(session.user.id))?.gender ?? null,
            settings
          )}
        />
      </div>
    </AppFrame>
  );
}
