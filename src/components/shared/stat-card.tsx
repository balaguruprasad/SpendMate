import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "default" | "pending" | "approved" | "rejected" | "paid";

const TONE_ICON: Record<Tone, string> = {
  default: "bg-primary/10 text-primary",
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  paid: "bg-info/15 text-info",
};

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  tone?: Tone;
  className?: string;
}

/** Metric tile — label, value, icon, optional hint and semantic tone. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-3 p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              TONE_ICON[tone],
            )}
          >
            <Icon className="size-4.5" />
          </span>
        )}
      </div>
      <p className="tnum text-2xl font-bold leading-none tracking-tight md:text-3xl">
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
