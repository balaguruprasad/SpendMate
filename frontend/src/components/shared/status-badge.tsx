import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Tone vocabulary for the generic status pill. Maps to the semantic tokens in
 * `globals.css` (`--success`/`--warning`/`--destructive`/`--info`) plus the
 * neutral `--muted` pair. Domain enums (invoice/vendor statuses) map to one of
 * these via the maps in `@/lib/finance/status` — this component stays generic.
 */
export type StatusTone =
  | "muted"
  | "info"
  | "warning"
  | "success"
  | "destructive";

/** Solid token used for text + border per tone. */
const TONE_FG: Record<StatusTone, string> = {
  muted: "var(--muted-foreground)",
  info: "var(--info)",
  warning: "var(--warning)",
  success: "var(--success)",
  destructive: "var(--destructive)",
};

/** Background base token, tinted to a faint fill via `color-mix`. */
const TONE_BG: Record<StatusTone, string> = {
  muted: "var(--muted)",
  info: "var(--info)",
  warning: "var(--warning)",
  success: "var(--success)",
  destructive: "var(--destructive)",
};

/**
 * Generic presentational status pill. Flat/editorial — faint tonal fill, solid
 * token for text + border, no glow. Server-safe (no client hooks).
 */
export function StatusBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: StatusTone;
  className?: string;
}) {
  const fg = TONE_FG[tone];
  const bg =
    tone === "muted"
      ? `color-mix(in oklab, ${TONE_BG[tone]} 60%, transparent)`
      : `color-mix(in oklab, ${TONE_BG[tone]} 12%, transparent)`;
  const border = `color-mix(in oklab, ${fg} 30%, transparent)`;

  return (
    <Badge
      className={cn("border", className)}
      style={
        {
          backgroundColor: bg,
          color: fg,
          borderColor: border,
        } as CSSProperties
      }
    >
      {label}
    </Badge>
  );
}
