import type { Transition, Variants } from "motion/react";

export const springs = {
  snappy: { type: "spring", stiffness: 180, damping: 22, mass: 1 },
  gentle: { type: "spring", stiffness: 160, damping: 20 },
  bouncy: { type: "spring", stiffness: 200, damping: 12 },
  drawer: { type: "spring", stiffness: 180, damping: 24 },
} satisfies Record<string, Transition>;

export const durations = {
  instant: 0.15,
  fast: 0.3,
  base: 0.4,
  slow: 0.5,
};

export const fadeSlideUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: durations.base, ease: "easeOut" } },
  exit: { opacity: 0, y: -12, transition: { duration: durations.fast, ease: "easeIn" } },
};

export const fadeScaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: durations.base, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: durations.fast, ease: "easeIn" } },
};

export const backdropFade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: durations.fast } },
  exit: { opacity: 0, transition: { duration: durations.fast } },
};

export const modalPanel: Variants = {
  initial: { opacity: 0, scale: 0.92, y: 24 },
  animate: { opacity: 1, scale: 1, y: 0, transition: springs.gentle },
  exit: { opacity: 0, scale: 0.95, y: 12, transition: { duration: durations.fast } },
};

export const drawerRight: Variants = {
  initial: { x: "100%" },
  animate: { x: 0, transition: springs.drawer },
  exit: { x: "100%", transition: { duration: durations.fast, ease: "easeIn" } },
};

export const drawerLeft: Variants = {
  initial: { x: "-100%" },
  animate: { x: 0, transition: springs.drawer },
  exit: { x: "-100%", transition: { duration: durations.fast, ease: "easeIn" } },
};

export const shakeTransition: Transition = { duration: 0.5 };

export const stagger = (index: number, base = 0.06, max = 0.4) => ({
  delay: Math.min(index * base, max),
});
