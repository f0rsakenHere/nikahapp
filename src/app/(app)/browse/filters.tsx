"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MADHHAB, PROVINCES } from "@/lib/domain/profile";
import { MADHHAB_LABELS, PROVINCE_LABELS } from "@/lib/domain/profile-labels";

const FIELD =
  "h-11 rounded-md border border-soft-green bg-white px-3 text-[13px] text-black outline-none focus:border-accent-deep";

/* Filters in the URL rather than in state.
 *
 * A filtered view is a thing people share with a friend, come back to,
 * and reach for with the back button. Keeping it in the address bar
 * gives all three for free, and means the server renders the right list
 * on first paint instead of a flash of everything. */
export function Filters({
  current,
}: {
  current: { ageMin?: string; ageMax?: string; province?: string; madhhab?: string };
}) {
  const router = useRouter();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/browse?${next.toString()}`);
  }

  const any = Boolean(current.ageMin || current.ageMax || current.province || current.madhhab);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          inputMode="numeric"
          placeholder="Youngest"
          defaultValue={current.ageMin ?? ""}
          onBlur={(e) => set("ageMin", e.target.value)}
          className={FIELD}
          aria-label="Youngest age"
        />
        <input
          type="number"
          inputMode="numeric"
          placeholder="Oldest"
          defaultValue={current.ageMax ?? ""}
          onBlur={(e) => set("ageMax", e.target.value)}
          className={FIELD}
          aria-label="Oldest age"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={current.province ?? ""}
          onChange={(e) => set("province", e.target.value)}
          className={FIELD}
          aria-label="Province"
        >
          <option value="">Anywhere</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {PROVINCE_LABELS[p]}
            </option>
          ))}
        </select>

        <select
          value={current.madhhab ?? ""}
          onChange={(e) => set("madhhab", e.target.value)}
          className={FIELD}
          aria-label="Madhhab"
        >
          <option value="">Any madhhab</option>
          {MADHHAB.map((m) => (
            <option key={m} value={m}>
              {MADHHAB_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {any ? (
        <button
          type="button"
          onClick={() => router.push("/browse")}
          className="self-start text-[12px] text-text underline-offset-2 hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
