import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { browseFor } from "@/lib/repositories/browse";
import { poolCounts } from "@/lib/repositories/profiles";
import { savedProfileIds } from "@/lib/repositories/shortlist";
import {
  balanceFor,
  countPendingInbound,
  ensureMonthlyGrant,
  readSettings,
} from "@/lib/repositories/connections";
import { MADHHAB, PROVINCES, inPool } from "@/lib/domain/profile";
import { SparkIcon } from "@/components/app/icons";
import { ProfileCard } from "@/components/app/profile-card";
import { AppFrame } from "../frame";
import { AskButton } from "./ask";
import { MarkButtons } from "./mark";
import { Filters } from "./filters";

export const metadata: Metadata = { title: "Browse — NikahCanada" };

type Search = {
  ageMin?: string;
  ageMax?: string;
  province?: string;
  madhhab?: string;
  saved?: string;
  new?: string;
};

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await currentUser();
  if (!session) redirect("/login?next=/browse");

  const me = await findProfileByUserId(session.user.id);
  if (!me) redirect(session.user.roles.includes("wali") ? "/wali" : "/register");

  const settings = await readSettings();
  const now = new Date();
  await ensureMonthlyGrant(session.user.id, settings, now);

  /* A member who is not in the pool browses nothing. Said plainly rather
   * than shown as an empty list, which reads like "nobody is here" and
   * sends people to support.
   *
   * Two different reasons to be out of it, and they are not the same
   * disappointment: with approval required this is a queue somebody else
   * has to work, and with it deferred it is a form the reader has not
   * finished. Telling the second person to wait for us would be a lie
   * about who is holding things up. */
  if (!inPool(me.status, settings)) {
    return (
      <AppFrame active="browse" width="wide" title="Browse">
        <div className="rounded-md border border-peach/40 bg-soft-peach/60 px-4 py-4">
          <p className="text-[18px] font-semibold text-peach-deep">Not yet.</p>
          <p className="mt-2 text-[18px] leading-[26px] text-text">
            {settings.requireVerifiedToBrowse
              ? "Browsing opens once your own profile is live. Ours is a closed pool — everyone in it has been checked, which is only true if it is also true of you."
              : "Browsing opens once you have finished your profile and sent it in. Everyone you would see has done the same, which is only fair if it is also true of you."}
          </p>
          <Link
            href="/onboarding"
            className="mt-3 inline-block text-[18px] font-semibold text-peach-deep underline-offset-2 hover:underline"
          >
            Your profile
          </Link>
        </div>
      </AppFrame>
    );
  }

  const params = await searchParams;
  const filters = {
    ageMin: params.ageMin ? Number(params.ageMin) : undefined,
    ageMax: params.ageMax ? Number(params.ageMax) : undefined,
    provinces: params.province ? [params.province as (typeof PROVINCES)[number]] : undefined,
    madhhab: params.madhhab ? [params.madhhab as (typeof MADHHAB)[number]] : undefined,
  };

  /* `saved` and `new` are the same page with a different scope rather
     than two more screens: the cards, the filters and the controls are
     identical, and the only thing that differs is which profiles reach
     them. */
  const scope = params.saved ? "saved" : params.new ? "new" : "pool";

  const [cards, balance, inbound, savedIds, pool] = await Promise.all([
    browseFor({ userId: session.user.id, gender: me.gender }, filters, settings, 40, scope),
    balanceFor(session.user.id),
    countPendingInbound(session.user.id),
    savedProfileIds(session.user.id),
    poolCounts(now, settings),
  ]);

  return (
    <AppFrame
      active="browse"
      width="wide"
      title={scope === "saved" ? "Saved" : scope === "new" ? "New this week" : "Browse"}
      /* Beside the title rather than under the tabs. On a phone the
         header was four stacked rows — tabs, wrapped tabs, the count,
         the balance — and the first profile began 447px down an 844px
         screen. This is the row that was already there. */
      aside={
        <span className="flex items-center gap-2 rounded-pill border border-soft-green bg-white px-3 py-1.5 text-[18px] font-semibold text-peach-deep">
          <SparkIcon className="text-[19px]" />
          {balance} connection{balance === 1 ? "" : "s"} left
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Three words and their counts, and nothing else. They needed
            356px where a 390pt iPhone has 350, so "Saved" was dropping
            to a line of its own — and then to a third row once the
            count and the balance wrapped under it. The two glyphs went
            (decoration beside a word that already says it) and the
            padding tightened, which is 64px back: one line on every
            phone down to a zoomed SE at 320. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/browse"
            aria-current={scope === "pool" ? "page" : undefined}
            className={`rounded-pill px-2.5 py-2 text-[18px] font-semibold transition-colors ${
              scope === "pool" ? "bg-accent/20 text-black" : "text-text hover:bg-mist"
            }`}
          >
            Everyone
          </Link>
          <Link
            href="/browse?new=1"
            aria-current={scope === "new" ? "page" : undefined}
            className={`flex items-center gap-2 rounded-pill px-2.5 py-2 text-[18px] font-semibold transition-colors ${
              scope === "new" ? "bg-accent/20 text-black" : "text-text hover:bg-mist"
            }`}
          >
            New
            {pool.newThisWeek ? (
              <span className="rounded-pill bg-peach px-2 text-[18px] text-black">
                {pool.newThisWeek}
              </span>
            ) : null}
          </Link>
          <Link
            href="/browse?saved=1"
            aria-current={scope === "saved" ? "page" : undefined}
            className={`flex items-center gap-2 rounded-pill px-2.5 py-2 text-[18px] font-semibold transition-colors ${
              scope === "saved" ? "bg-accent/20 text-black" : "text-text hover:bg-mist"
            }`}
          >
            Saved
            {savedIds.length ? (
              <span className="rounded-pill bg-peach px-2 text-[18px] text-black">
                {savedIds.length}
              </span>
            ) : null}
          </Link>
        </div>
        {/* What is on this screen, then what is behind it. The second
            number is the whole pool — counted, never configured — so a
            member who has filtered down to two people can still see that
            the service is not two people. */}
        <span className="text-[18px] text-text">
          {cards.length} {cards.length === 1 ? "profile" : "profiles"}
          <span className="text-text/70"> · {pool.total} in the pool</span>
        </span>
      </div>

      {settings.inboundCap !== null && inbound >= settings.inboundCap ? (
        /* Explained rather than silently applied: someone who has
           disappeared from browse deserves to know it is because they
           have requests waiting, not because something is broken. */
        <p className="mb-4 rounded-md border border-soft-green bg-mist px-3.5 py-3 text-[18px] leading-[26px] text-text">
          You have {inbound} requests waiting, so you are not being shown to anyone new until you
          answer some. It keeps your list manageable.
        </p>
      ) : null}

      <Filters current={params} />

      {cards.length === 0 ? (
        <p className="mt-6 rounded-md border border-soft-green bg-mist px-4 py-6 text-center text-[18px] leading-[26px] text-text">
          {scope === "saved"
            ? "Nothing saved yet. The heart on a card sets somebody aside to think about — it costs no connection and they are never told."
            : scope === "new"
              ? settings.requireVerifiedToBrowse
                ? "Nobody new this week. Everyone here is checked and telephoned before they are let in, so the pool grows slowly on purpose."
                : "Nobody new this week. The pool is small and grows a person at a time."
              : "Nobody matches that just now. Widening the age range or the province is usually enough — the pool is small and deliberately so."}
        </p>
      ) : (
        <ul
          /* A column of full-width rows is right on a phone and wrong
             on a monitor, where it becomes a single file of cards with
             half the screen empty beside them. */
          className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        >
          {cards.map((c) => (
            <li key={c.profileId} className="h-full">
              {/* Save and pass sit beside Ask, because they are the two
                  cheaper answers to the same question and hiding them
                  behind the profile page means nobody finds them. */}
              <ProfileCard
                card={c}
                actions={
                  <>
                    <div className="min-w-0 flex-1">
                      <AskButton
                        profileId={c.profileId}
                        alreadyAsked={c.alreadyAsked}
                        charge={settings.connectionCharge}
                      />
                    </div>
                    <MarkButtons profileId={c.profileId} current={c.marked} />
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-[18px] leading-[26px] text-text/70">
        Members appear as initials. No names and no photographs — those come later, and only with
        consent.
      </p>
    </AppFrame>
  );
}
