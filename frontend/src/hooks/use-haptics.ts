"use client";

/**
 * Tiny haptic-feedback helper around the Vibration API. No-ops on unsupported
 * devices (desktop, iOS Safari) and when the user prefers reduced motion, so
 * callers can fire freely without guarding. Patterns are deliberately subtle.
 */
import * as React from "react";

type Pattern = number | number[];

function vibrate(pattern: Pattern): void {
  if (typeof window === "undefined") return;
  if (!("vibrate" in navigator) || typeof navigator.vibrate !== "function") {
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore — vibration is best-effort.
  }
}

export interface Haptics {
  /** Light tap for selection / toggle changes. */
  select: () => void;
  /** Slightly firmer tap for primary actions. */
  impact: () => void;
  /** Double pulse for success. */
  success: () => void;
  /** Buzz for errors / destructive confirmations. */
  error: () => void;
}

export function useHaptics(): Haptics {
  return React.useMemo<Haptics>(
    () => ({
      select: () => vibrate(8),
      impact: () => vibrate(15),
      success: () => vibrate([10, 40, 10]),
      error: () => vibrate([20, 50, 20]),
    }),
    [],
  );
}
