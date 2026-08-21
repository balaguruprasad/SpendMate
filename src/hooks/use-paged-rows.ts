"use client";

/**
 * Client-side pagination over an in-memory row array. Returns the current page
 * slice plus controls. Clamps the active page back into range whenever the row
 * set shrinks below the current page (e.g. after a filter), so callers never
 * render an empty page. `startIndex` is the zero-based offset of the first row
 * on the page, used to derive a continuous Sr. No. across pages.
 */
import { useEffect, useMemo, useState } from "react";

export interface PagedRows<T> {
  page: number;
  setPage: (p: number) => void;
  pageCount: number;
  pageRows: T[];
  /** (page - 1) * pageSize — offset of the first visible row, for Sr. No. */
  startIndex: number;
}

export function usePagedRows<T>(rows: T[], pageSize = 10): PagedRows<T> {
  const [page, setPage] = useState(1);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(rows.length / pageSize)),
    [rows.length, pageSize],
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * pageSize;

  const pageRows = useMemo(
    () => rows.slice(startIndex, startIndex + pageSize),
    [rows, startIndex, pageSize],
  );

  return { page: safePage, setPage, pageCount, pageRows, startIndex };
}
