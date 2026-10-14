/* The shape of a screen, before the screen.
 *
 * Switching tabs waits on the server, and until now the wait showed the
 * page you were leaving: no spinner, no movement, nothing to say the tap
 * had registered. On a phone over mobile data that is a second or more
 * of a product that looks broken.
 *
 * These are the stand-ins. They are deliberately the *shape* of what is
 * coming — a row of cards, a list of threads — rather than a spinner in
 * the middle of an empty page: the eye settles on the layout while it
 * waits, and nothing jumps when the real thing arrives.
 *
 * `animate-pulse` is Tailwind's, which is an opacity cycle and so is
 * already safe for a reader who has asked for reduced motion; the
 * stylesheet pins it to rest for them along with the other loops.
 */

export function Bar({ className = "" }: { className?: string }) {
  return <span className={`block rounded-sm bg-soft-green/70 ${className}`} />;
}

/** One card's worth of grey, at the height the real card settles at. */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-md border border-soft-green bg-white p-4">
      <Bar className="h-4 w-1/3" />
      <div className="mt-3 flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Bar key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

/** A grid of them, for the pool and anything else card-shaped. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} lines={4} />
        ))}
      </div>
    </div>
  );
}

/** Stacked rows: requests, threads, notifications. */
export function RowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="animate-pulse flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3.5 rounded-md border border-soft-green bg-white px-3.5 py-3.5"
        >
          <span className="h-10 w-10 shrink-0 rounded-full bg-soft-green/70" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <Bar className="h-3.5 w-1/3" />
            <Bar className="h-3 w-2/3" />
          </span>
        </div>
      ))}
    </div>
  );
}

/** The dashboard: one wide panel, then a row of counters. */
export function PanelsSkeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-6">
      <div className="rounded-lg border border-soft-green bg-white p-5">
        <Bar className="h-3 w-24" />
        <Bar className="mt-4 h-6 w-48" />
        <Bar className="mt-4 h-1.5 w-full" />
        <div className="mt-5 flex gap-2.5">
          <Bar className="h-12 w-44 rounded-pill" />
          <Bar className="h-12 w-36 rounded-pill" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-md border border-soft-green bg-white p-4">
            <Bar className="h-5 w-20" />
            <Bar className="mt-2.5 h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A form, for the profile steps and the account screen. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="animate-pulse flex flex-col gap-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Bar className="h-3 w-28" />
          <Bar className="h-12 w-full rounded-md" />
        </div>
      ))}
      <Bar className="h-12 w-full max-w-[420px] rounded-pill" />
    </div>
  );
}
