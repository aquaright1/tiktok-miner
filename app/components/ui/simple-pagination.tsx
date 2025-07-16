import * as React from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface SimplePaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

export function SimplePagination({ currentPage, totalPages, onPageChange, disabled = false }: SimplePaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const maxVisiblePages = 5
  const halfMaxVisiblePages = Math.floor(maxVisiblePages / 2)

  let startPage = Math.max(1, currentPage - halfMaxVisiblePages)
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1)
  }

  const visiblePages = pages.slice(startPage - 1, endPage)


  return (
    <div className="flex items-center gap-2">
      {/* Previous Button */}
      <Button
        variant="outline"
        size="icon"
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPageChange(currentPage - 1);
        }}
        disabled={disabled || currentPage === 1}
        aria-label="Go to previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* First page + ellipsis */}
      {startPage > 1 && (
        <>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPageChange(1);
            }}
            disabled={disabled}
          >
            1
          </Button>
          {startPage > 2 && (
            <span className="px-2">...</span>
          )}
        </>
      )}

      {/* Visible page numbers */}
      {visiblePages.map((page) => (
        <Button
          key={page}
          variant={currentPage === page ? "default" : "outline"}
          size="sm"
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPageChange(page);
          }}
          disabled={disabled}
        >
          {page}
        </Button>
      ))}

      {/* Last page + ellipsis */}
      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && (
            <span className="px-2">...</span>
          )}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPageChange(totalPages);
            }}
            disabled={disabled}
          >
            {totalPages}
          </Button>
        </>
      )}

      {/* Next Button */}
      <Button
        variant="outline"
        size="icon"
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPageChange(currentPage + 1);
        }}
        disabled={disabled || currentPage === totalPages}
        aria-label="Go to next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}