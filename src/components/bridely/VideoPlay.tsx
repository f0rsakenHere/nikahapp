"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/* The play control over the video band, and the lightbox behind it.

   The template used a PNG over a magnific-popup lightbox. This draws the
   control as SVG so it stays crisp at any size, and opens a plain <video>
   in a modal — no lightbox library, no external requests.

   `href` is null until a real film exists. The control still renders,
   because it is part of the composition, but with nothing to open it is
   inert and hidden from assistive tech rather than announcing a button
   that does nothing. Set video.href and it becomes live. */
export function VideoPlay({ href }: { href: string | null }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    // the page must not scroll behind the modal
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      returnTo.current?.focus();
    };
  }, [open, close]);

  const mark = (
    <span className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)] sm:h-[120px] sm:w-[120px]">
      <svg
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden
        className="ml-1 h-6 w-6 text-peach sm:h-9 sm:w-9"
      >
        <path d="M8 4.5v23l19-11.5L8 4.5z" />
      </svg>
    </span>
  );

  if (!href) {
    return (
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        {mark}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Play the film"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 hover:scale-110"
      >
        {mark}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          >
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close video"
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition-colors hover:bg-white/20"
            >
              ×
            </button>
            <video
              src={href}
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
              className="max-h-[80vh] w-full max-w-[960px] rounded-lg"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
