import Link from "next/link";
import type { ReactNode } from "react";
import type { BrowseCard } from "@/lib/repositories/browse";
import { ACTIVITY_LABELS } from "@/lib/domain/activity";
import {
  EDUCATION_LABELS,
  MADHHAB_LABELS,
  MARITAL_STATUS_LABELS,
  PROVINCE_LABELS,
  SALAH_LABELS,
} from "@/lib/domain/profile-labels";
import {
  HeightIcon,
  MapPinIcon,
  PrayerIcon,
  RingsIcon,
  SchoolIcon,
  SparkleIcon,
  SpeechIcon,
  WorkIcon,
} from "./icons";

/* One member, as a card.
 *
 * Lives here rather than in the browse page because the dashboard shows
 * the same people — suggestions are browse results in a different order —
 * and two hand-written cards for one thing is how two screens end up
 * disagreeing about what a profile looks like. What differs between the
 * callers is passed in: browse hangs Ask and Save off the bottom, the
 * dashboard prints the reasons a profile was suggested. Neither changes
 * the shape.
 */

/* Stored in centimetres, read in feet and inches by most of this
   audience — the same reasoning as the height dropdown. */
function feetAndInches(cm: number): string {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}′${inches % 12}″ · ${cm} cm`;
}

/* The one reason that is worth more than the others put together, so it
   is the one that gets the accent rather than the mist. */
const MUTUAL = "you fit what they are looking for";

export function ProfileCard({
  card: c,
  /** Why this person is in front of the reader, in their own answers. */
  reasons,
  /** Buttons for the foot of the card. Anything here must opt back into
   *  pointer events — the whole card is covered by a stretched link. */
  actions,
}: {
  card: BrowseCard;
  reasons?: string[];
  actions?: ReactNode;
}) {
  /* One shape for every fact, so the eye finds the same thing in the
     same place on every card. An icon carries the category and the label
     is for screen readers — printing "Prays: five daily" on a card this
     size would double its height to say nothing new. */
  const facts = [
    {
      Icon: PrayerIcon,
      label: "Practice",
      text: [
        c.salah ? SALAH_LABELS[c.salah as never] : null,
        c.madhhab ? MADHHAB_LABELS[c.madhhab as never] : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      Icon: RingsIcon,
      label: "Marital status",
      text: [
        c.maritalStatus ? MARITAL_STATUS_LABELS[c.maritalStatus as never] : null,
        /* Only when there are any. "No children" on every never-married
           card is noise. */
        c.children && c.children !== "none" ? "has children" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      Icon: SchoolIcon,
      label: "Education",
      text: c.education ? EDUCATION_LABELS[c.education as never] : "",
    },
    { Icon: SpeechIcon, label: "Speaks", text: (c.languages ?? []).join(", ") },
    {
      Icon: HeightIcon,
      label: "Height",
      text: [
        c.heightCm ? feetAndInches(c.heightCm) : null,
        c.willingToRelocate && c.willingToRelocate !== "no"
          ? c.willingToRelocate === "yes"
            ? "would relocate"
            : "might relocate"
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  ].filter((f) => f.text);

  const who = `${c.gender === "sister" ? "Sister" : "Brother"}${c.age ? `, ${c.age}` : ""}`;

  /* One badge only, and asked outranks new: what the reader has already
     done about this person matters more than when they arrived. */
  const badge = c.alreadyAsked ? "Asked" : c.isNew ? "New" : null;

  return (
    /* The card is a container, not a link — there is a form in it on
       browse, and a form inside an anchor is invalid and fights the
       click. The whole surface is still clickable: a stretched link
       covers it, and only the buttons take pointer events above it. */
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-soft-green bg-white transition-all hover:-translate-y-0.5 hover:border-accent-deep hover:shadow-[0_12px_32px_-20px_rgba(20,18,18,0.45)]">
      <Link
        href={`/browse/${c.profileId}`}
        className="absolute inset-0 z-0"
        aria-label={`${who}${c.city ? `, ${c.city}` : ""}`}
      />

      {/* A tinted head, so the identity block is not competing with the
          facts below it for the same white ground — with a fixed floor
          under it, so the band lands on the same line across a row
          however long somebody's city is. Without that, one "Vancouver,
          British Columbia" among three "Montreal"s made every card in
          the row a different shape.

          The badge sits out of the flow, in the corner. In the row it
          took eighty pixels off the only column with words in it, and at
          four cards across that was the difference between "Mississauga,
          Ontario" on one line and "Mississaug / a, Ontario" on two. */}
      <div
        className={`pointer-events-none relative flex min-h-[108px] items-center gap-3.5 border-b border-soft-green bg-mist/50 px-4 py-3.5 ${
          badge ? "pr-[86px]" : ""
        }`}
      >
        <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-soft-peach font-manrope text-[18px] font-bold text-peach-deep">
          {c.initials ?? "—"}
        </span>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <span className="font-manrope text-[22px] font-bold leading-tight text-black">{who}</span>
          {/* Wraps rather than truncates. Where somebody lives is one of
              the three things this card exists to say, so it gets a
              second line if it needs one — and no more than two. */}
          {c.city || c.province ? (
            <span className="mt-0.5 flex items-start gap-1.5 text-[18px] leading-[24px] text-text">
              <MapPinIcon className="mt-0.5 shrink-0 text-[17px] text-accent-deep" />
              <span className="line-clamp-2">
                {[c.city, c.province ? PROVINCE_LABELS[c.province as never] : null]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </span>
          ) : null}
        </div>
        {badge ? (
          <span
            className={`absolute right-3 top-3 rounded-pill px-2.5 py-1 text-[18px] font-semibold ${
              badge === "Asked" ? "bg-white text-accent-deep" : "bg-peach text-black"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-4 py-3.5">
        {c.occupation ? (
          <p className="pointer-events-none relative flex items-center gap-1.5 text-[18px] font-semibold text-black">
            <WorkIcon className="shrink-0 text-[17px] text-accent-deep" />
            <span className="truncate">{c.occupation}</span>
          </p>
        ) : null}

        {/* Their own words. The one thing here that is not a category — a
            list of attributes says what somebody is, a sentence says who.
            Two lines; the rest is on their profile. */}
        {c.about ? (
          <p className="pointer-events-none relative mt-2 line-clamp-2 text-[18px] leading-[26px] text-text">
            {c.about}
          </p>
        ) : null}

        {/* One column, not two. Two fitted more on screen and cut every
            value in half — "Never marr…", "Bachelor's …" — which is not
            information, it is the shape of information. Related facts
            share a row instead. */}
        <dl className="pointer-events-none relative mt-3.5 flex flex-col gap-2">
          {facts.map(({ Icon, label, text }) => (
            <div key={label} className="flex min-w-0 items-start gap-2">
              <Icon className="mt-1 shrink-0 text-[18px] text-accent-deep" />
              <dt className="sr-only">{label}</dt>
              <dd className="text-[18px] leading-[26px] text-text">{text}</dd>
            </div>
          ))}
        </dl>

        {/* Presence, in the only terms this product will state it: a band
            wide enough to be useless for working out somebody's routine,
            and narrow enough to answer "will they see this if I write".
            Today gets the live dot; the wider bands do not, because a
            steady green light against "this month" would be claiming
            more than the sentence says. */}
        {c.activity ? (
          <p className="pointer-events-none relative mt-3 flex items-center gap-2 text-[18px] text-text/70">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                c.activity === "today" ? "bg-accent-deep" : "bg-soft-green"
              }`}
              aria-hidden
            />
            {ACTIVITY_LABELS[c.activity]}
          </p>
        ) : null}

        {/* Why they are being shown, when somebody is being shown rather
            than searched for. Kept to the foot of the card: the reader
            wants to know who this is first and why we thought so second. */}
        {reasons?.length ? (
          <ul className="pointer-events-none relative mt-4 flex flex-wrap gap-1.5 border-t border-dashed border-soft-green pt-3.5">
            {reasons.map((r) =>
              r === MUTUAL ? (
                <li
                  key={r}
                  className="flex items-center gap-1.5 rounded-pill bg-accent/30 px-2.5 py-1 text-[18px] font-semibold text-black"
                >
                  <SparkleIcon className="text-[17px] text-accent-deep" />
                  {r}
                </li>
              ) : (
                <li key={r} className="rounded-pill bg-mist px-2.5 py-1 text-[18px] text-text">
                  {r}
                </li>
              )
            )}
          </ul>
        ) : null}

        {/* Pinned to the bottom, so every button in a row sits on the
            same line however much its card had to say. */}
        {actions ? (
          <div className="pointer-events-none relative z-10 mt-auto flex items-center gap-2 pt-4">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
