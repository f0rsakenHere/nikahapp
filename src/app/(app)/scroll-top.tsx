"use client";

/* Every screen starts at its own top.
 *
 * A step of the profile builder is submitted from a button at the foot
 * of a long form, and the next step used to arrive scrolled to wherever
 * the last one had been left — halfway down, past its own heading. The
 * browser restores the scroll position across a same-document
 * navigation, which is what you want from the back button and not what
 * you want walking forwards through a form.
 *
 * Renders nothing. It belongs in the frames rather than in the pages so
 * that a screen added later cannot forget it.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    /* Instant, not smooth: this is not a movement the reader asked for,
       and animating it reads as the page sliding away under them. */
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return null;
}
