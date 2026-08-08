import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/current";
import { findProfileByUserId } from "@/lib/repositories/profiles";
import { browseFor } from "@/lib/repositories/browse";
import {
  balanceFor,
  countPendingInbound,
  ensureMonthlyGrant,
  readSettings,
} from "@/lib/repositories/connections";
import {
  MADHHAB_LABELS,
  MARITAL_STATUS_LABELS,
  PROVINCE_LABELS,
  SALAH_LABELS,
} from "@/lib/domain/profile-labels";
import { MADHHAB, PROVINCES } from "@/lib/domain/profile";
import { AppFrame } from "../frame";
import { Filters } from "./filters";

export const metadata: Metadata = { title: "Browse — NikahCanada" };

type Search = { ageMin?: string; ageMax?: string; province?: string; madhhab?: string };

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

  /* A member whose own profile is not live browses nothing. Said plainly
   * rather than shown as an empty list, which reads like "nobody is
   * here" and sends people to support. */
  if (settings.requireVerifiedToBrowse && me.status !== "live") {
    return (
      <AppFrame active="browse" title="Browse">
        <div className="rounded-md border border-peach/40 bg-soft-peach/60 px-4 py-4">
          <p className="text-[14px] font-semibold text-peach-deep">Not yet.</p>
          <p className="mt-2 text-[13px] leading-[20px] text-text">
            Browsing opens once your own profile is live. Ours is a closed pool — everyone in it
            has been checked, which is only true if it is also true of you.
          </p>
          <Link
            href="/onboarding"
            className="mt-3 inline-block text-[13px] font-semibold text-peach-deep underline-offset-2 hover:underline"
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

  const [cards, balance, inbound] = await Promise.all([
    browseFor({ userId: session.user.id, gender: me.gender }, filters, settings),
    balanceFor(session.user.id),
    countPendingInbound(session.user.id),
  ]);

  return (
    <AppFrame active="browse" title="Browse">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="text-[13px] text-text">
          {cards.length} {cards.length === 1 ? "profile" : "profiles"}
        </span>
        <span className="text-[13px] font-semibold text-peach-deep">
          {balance} connection{balance === 1 ? "" : "s"} left
        </span>
      </div>

      {settings.inboundCap !== null && inbound >= settings.inboundCap ? (
        /* Explained rather than silently applied: someone who has
           disappeared from browse deserves to know it is because they
           have requests waiting, not because something is broken. */
        <p className="mb-4 rounded-md border border-soft-green bg-mist px-3.5 py-3 text-[13px] leading-[19px] text-text">
          You have {inbound} requests waiting, so you are not being shown to anyone new until you
          answer some. It keeps your list manageable.
        </p>
      ) : null}

      <Filters current={params} />

      {cards.length === 0 ? (
        <p className="mt-6 rounded-md border border-soft-green bg-mist px-4 py-6 text-center text-[14px] leading-[21px] text-text">
          Nobody matches that just now. Widening the age range or the province is usually enough —
          the pool is small and deliberately so.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {cards.map((c) => (
            <li key={c.profileId}>
              <Link
                href={`/browse/${c.profileId}`}
                className="flex gap-3.5 rounded-md border border-soft-green bg-white p-3.5 transition-colors hover:border-accent-deep"
              >
                <span
                  className="grid h-[52px] w-[52px] shrink-0 place-items-center bg-soft-peach font-playfair text-[15px] font-bold text-peach-deep"
                  style={{ borderRadius: "18px 0 18px 0" }}
                >
                  {c.initials ?? "—"}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-black">
                      {c.gender === "sister" ? "Sister" : "Brother"}
                      {c.age ? ` · ${c.age}` : ""}
                    </span>
                    {c.alreadyAsked ? (
                      <span className="rounded-pill bg-soft-green/60 px-2 py-0.5 text-[11px] text-text">
                        asked
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[12px] text-text">
                    {[c.city, c.province ? PROVINCE_LABELS[c.province as never] : null, c.occupation]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {[
                      c.salah ? SALAH_LABELS[c.salah as never] : null,
                      c.madhhab ? MADHHAB_LABELS[c.madhhab as never] : null,
                      c.maritalStatus ? MARITAL_STATUS_LABELS[c.maritalStatus as never] : null,
                    ]
                      .filter(Boolean)
                      .map((t) => (
                        <span
                          key={String(t)}
                          className="rounded-pill bg-soft-green/50 px-2.5 py-1 text-[11px] text-text"
                        >
                          {t}
                        </span>
                      ))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-[11px] leading-[16px] text-text/70">
        Members appear as initials. No names and no photographs — those come later, and only with
        consent.
      </p>
    </AppFrame>
  );
}
