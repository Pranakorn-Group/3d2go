"use client";

import { motion, type HTMLMotionProps, type Variants } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts its content in on mount. Used for page transitions (backstore template) and standalone pages. */
export function FadeIn({ delay = 0, ...props }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease, delay }}
      {...props}
    />
  );
}

const MAX_STAGGERED = 15;

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  // Delay by position, capped so long lists (sales, orders) still finish appearing in well under a second.
  show: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease, delay: Math.min(index, MAX_STAGGERED) * 0.04 },
  }),
};

/** A container whose StaggerItem children animate in one after another. Drop-in for a grid/list `div`. */
export function Stagger(props: HTMLMotionProps<"div">) {
  return <motion.div initial="hidden" animate="show" {...props} />;
}

/** Pass the item's position as `index` to stagger it; items added later animate in on their own. */
export function StaggerItem({ index = 0, ...props }: HTMLMotionProps<"div"> & { index?: number }) {
  return <motion.div variants={itemVariants} custom={index} {...props} />;
}
