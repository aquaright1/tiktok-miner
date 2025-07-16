import * as React from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const maxVisiblePages = 5
  const halfMaxVisiblePages = Math.floor(maxVisiblePages / 2)
  
  const handlePageChange = (e: React.MouseEvent, page: number) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Pagination: Changing from page', currentPage, 'to', page);
    onPageChange(page);
  }

  let startPage = Math.max(1, currentPage - halfMaxVisiblePages)
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1)
  }

  const visiblePages = pages.slice(startPage - 1, endPage)

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        type="button"
        onClick={(e) => handlePageChange(e, currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {startPage > 1 && (
        <>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={(e) => handlePageChange(e, 1)}
          >
            1
          </Button>
          {startPage > 2 && (
            <span className="px-2">...</span>
          )}
        </>
      )}

      {visiblePages.map((page) => (
        <Button
          key={page}
          variant={currentPage === page ? "default" : "outline"}
          size="sm"
          type="button"
          onClick={(e) => handlePageChange(e, page)}
        >
          {page}
        </Button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && (
            <span className="px-2">...</span>
          )}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={(e) => handlePageChange(e, totalPages)}
          >
            {totalPages}
          </Button>
        </>
      )}

      <Button
        variant="outline"
        size="icon"
        type="button"
        onClick={(e) => handlePageChange(e, currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
} 