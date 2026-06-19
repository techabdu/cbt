"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Paginated } from "@/types/common.types";

interface PaginationProps {
  meta: Paginated<unknown>["meta"];
  onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
  const { current_page, last_page, from, to, total } = meta;

  return (
    <div className="flex items-center justify-between gap-4 px-1 pt-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(current_page - 1)}
          disabled={current_page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-slate-600 dark:text-slate-300">
          Page {current_page} of {last_page}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(current_page + 1)}
          disabled={current_page >= last_page}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
