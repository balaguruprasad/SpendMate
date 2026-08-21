"use client";

/**
 * Client-side pager built on the shadcn `ui/pagination` primitive. Renders a
 * Previous control, a windowed set of numbered page links (with ellipses when
 * the count is large), and a Next control. Navigation is handled via `onClick`
 * (no hrefs) so it drives the parent's `usePagedRows` state. Returns null when
 * there is a single page (nothing to paginate).
 */
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface TablePaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
  className?: string;
}

/** Windowed page numbers around the current page, with -1 marking an ellipsis. */
function buildPages(page: number, pageCount: number): number[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const pages: number[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) pages.push(-1);
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < pageCount - 1) pages.push(-1);

  pages.push(pageCount);
  return pages;
}

export function TablePagination({
  page,
  pageCount,
  onPageChange,
  className,
}: TablePaginationProps) {
  if (pageCount <= 1) return null;

  const pages = buildPages(page, pageCount);
  const onFirst = page <= 1;
  const onLast = page >= pageCount;

  return (
    <Pagination className={cn(className)}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={onFirst}
            tabIndex={onFirst ? -1 : undefined}
            className={cn(onFirst && "pointer-events-none opacity-50")}
            onClick={(e) => {
              e.preventDefault();
              if (!onFirst) onPageChange(page - 1);
            }}
          />
        </PaginationItem>

        {pages.map((p, i) =>
          p === -1 ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                isActive={p === page}
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(p);
                }}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            aria-disabled={onLast}
            tabIndex={onLast ? -1 : undefined}
            className={cn(onLast && "pointer-events-none opacity-50")}
            onClick={(e) => {
              e.preventDefault();
              if (!onLast) onPageChange(page + 1);
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
