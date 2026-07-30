"use client";

import Image from "next/image";
import { motion } from "motion/react";

/* The decorative birds, hearts and rings scattered behind the sections.

   Replaces the template's `.star` class, whose keyframes were:
     0%   opacity 0, scale(1.5) translateY(-0.75em)
     20%  opacity 1
     89%  opacity 1, scale(1)
     100% opacity 0, translateZ(-1000em)
   over 10s ease-out, infinite. The translateZ step had no perspective
   ancestor so it never rendered as depth — it only ever read as a fade.

   MotionConfig drops the transform half for reduced-motion readers but
   would leave the opacity looping forever, so the `.twinkle` hook in
   globals.css pins these fully visible instead. */
export function Twinkle({
  src,
  width,
  height,
  alt = "",
  className,
  priority,
}: {
  src: string;
  width: number;
  height: number;
  alt?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <motion.figure
      className={`twinkle ${className ?? ""}`}
      aria-hidden
      animate={{ opacity: [0, 1, 1, 0], scale: [1.5, 1, 1], y: [-12, 0, 0] }}
      transition={{
        duration: 10,
        repeat: Infinity,
        ease: "easeOut",
        opacity: { times: [0, 0.2, 0.89, 1] },
        scale: { times: [0, 0.89, 1] },
        y: { times: [0, 0.89, 1] },
      }}
    >
      <Image
        src={src}
        width={width}
        height={height}
        alt={alt}
        priority={priority}
        className="h-auto w-full"
      />
    </motion.figure>
  );
}
