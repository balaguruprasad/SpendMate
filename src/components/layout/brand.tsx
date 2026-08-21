import { cn } from "@/lib/utils";

/**
 * Square Mesa brand mark — the "m" tile rendered as a CSS mask filled with
 * `currentColor` (ink on light, white on dark) so no asset swap is needed.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("block size-8 rounded-lg bg-foreground", className)}
      style={{
        WebkitMaskImage: "url(/mesa-mark-ink.png)",
        maskImage: "url(/mesa-mark-ink.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
      aria-hidden
    />
  );
}

/** Full lockup for the sidebar header — mark + wordmark + workspace subhead. */
export function AppBrand({ workspace }: { workspace?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-tight">
        <p className="font-bold tracking-tight">
          Spend<span className="font-medium text-muted-foreground">Mate</span>
        </p>
        {workspace && (
          <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
            {workspace}
          </p>
        )}
      </div>
    </div>
  );
}
