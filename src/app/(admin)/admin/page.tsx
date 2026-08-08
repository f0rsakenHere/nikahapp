import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/actions";
import { listQueue } from "@/lib/repositories/profiles";
import { AdminShell } from "../shell";

export const metadata: Metadata = { title: "Review queue — NikahCanada staff" };

function waitingFor(since: Date | null): string {
  if (!since) return "—";
  const hours = Math.floor((Date.now() - since.getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/* The review queue. Oldest first — the person who has been waiting
 * longest is the one to serve next, and a queue sorted any other way
 * quietly abandons the tail. */
export default async function QueuePage() {
  const { user } = await requireStaff();
  const rows = await listQueue("pendingReview");

  return (
    <AdminShell
      title="Review queue"
      subtitle={
        rows.length
          ? `${rows.length} profile${rows.length === 1 ? "" : "s"} waiting`
          : "Nothing waiting."
      }
      user={user}
    >
      {rows.length === 0 ? (
        <p className="rounded-md border border-soft-green bg-mist px-4 py-6 text-center text-[14px] text-text">
          No profiles are waiting for review.
        </p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-soft-green text-[11px] font-semibold uppercase tracking-[0.6px] text-text/70">
              <th className="py-2 pr-3">Member</th>
              <th className="py-2 pr-3">Where</th>
              <th className="py-2 pr-3">Born</th>
              <th className="py-2 pr-3">Waiting</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.profileId} className="border-b border-soft-green/70">
                <td className="py-3 pr-3">
                  <span className="text-[14px] font-semibold text-black">
                    {/* Initials, not a name. Nothing on this screen needs
                        a legal name, and reading one is an audited event
                        — so the queue does not casually spend one. */}
                    {row.initials ?? "—"}
                  </span>
                  <span className="ml-2 text-[12px] text-text/70">
                    {row.gender === "sister" ? "Sister" : "Brother"}
                  </span>
                </td>
                <td className="py-3 pr-3 text-[13px] text-text">
                  {[row.city, row.province].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="py-3 pr-3 text-[13px] text-text">{row.birthYear ?? "—"}</td>
                <td className="py-3 pr-3 text-[13px] text-text">{waitingFor(row.submittedAt)}</td>
                <td className="py-3 text-right">
                  <Link
                    href={`/admin/members/${row.profileId}`}
                    className="rounded-pill border border-soft-green px-3 py-1.5 text-[12px] font-semibold text-accent-deep"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
