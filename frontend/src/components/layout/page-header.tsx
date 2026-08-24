import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/** Top of every page — eyebrow, title, description, actions; brand wash. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "soft-accent-wash -mx-4 -mt-4 rounded-b-2xl border-b border-border/60 px-4 pb-6 pt-2 md:-mx-6 md:px-6 md:pt-3 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      <div className="flex flex-col gap-4 @2xl/main:flex-row @2xl/main:items-end @2xl/main:justify-between">
        <div className="space-y-1.5">
          {eyebrow && (
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-bold leading-tight md:text-[1.75rem]">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
