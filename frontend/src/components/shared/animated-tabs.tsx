"use client";

/**
 * Controlled segmented tabs with a motion sliding pill. The active pill is a
 * single `motion.span` shared across triggers via `layoutId`, so switching tabs
 * animates the accent pill from one to the next (spring). Soft accent fill +
 * generous padding. Pass a unique `layoutId` if more than one set is on screen.
 */
import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface AnimatedTab {
  value: string;
  label: React.ReactNode;
}

interface AnimatedTabsProps {
  tabs: AnimatedTab[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  layoutId?: string;
}

export function AnimatedTabs({
  tabs,
  value,
  onValueChange,
  className,
  layoutId = "animated-tab-pill",
}: AnimatedTabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted/60 p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              "relative z-0 rounded-md px-3 py-1.5 text-[0.8rem] font-medium whitespace-nowrap transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 -z-10 rounded-md bg-foreground shadow-sm"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
