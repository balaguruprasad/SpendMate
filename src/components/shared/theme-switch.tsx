// Animated light/dark theme toggle.
//
// The icon morphs with a motion/react spring, and the theme change sweeps in as
// a circular reveal from the click point via the View Transitions API (falls
// back to an instant switch when unsupported or reduced-motion is requested).
"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useHaptics } from "@/hooks/use-haptics";

export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const haptics = useHaptics();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch — render a stable placeholder until mounted.
  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  const toggle = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      haptics.select();
      const next = isDark ? "light" : "dark";
      const root = document.documentElement;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      // Fallback: no View Transitions support, or user prefers reduced motion.
      if (!document.startViewTransition || reduceMotion) {
        setTheme(next);
        return;
      }

      const x = e.clientX;
      const y = e.clientY;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      const transition = document.startViewTransition(() => {
        // flushSync so next-themes applies the class before the snapshot.
        flushSync(() => setTheme(next));
      });

      transition.ready.then(() => {
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 480,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      });
    },
    [haptics, isDark, setTheme],
  );

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={
        !mounted
          ? "Toggle theme"
          : isDark
            ? "Switch to light mode"
            : "Switch to dark mode"
      }
      className="relative overflow-hidden text-muted-foreground"
    >
      <AnimatePresence mode="wait" initial={false}>
        {mounted && (
          <motion.span
            key={isDark ? "moon" : "sun"}
            initial={{ y: -18, opacity: 0, rotate: -90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 18, opacity: 0, rotate: 90 }}
            transition={{ type: "spring", stiffness: 320, damping: 20, mass: 0.6 }}
            className="absolute inset-0 flex cursor-pointer items-center justify-center"
          >
            {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
