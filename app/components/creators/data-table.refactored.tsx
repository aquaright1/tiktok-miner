"use client"

import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  RowSelectionState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import "./data-table-sticky.css"

// Type constraint to ensure data has an id property
interface DataWithId {
  id: string | number
}

interface DataTableProps<TData extends DataWithId, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  enableRowSelection?: boolean
  onRowSelectionChange?: (selectedRows: TData[]) => void
  onSortingChange?: (sorting: SortingState) => void
  emptyMessage?: string
  loadingMessage?: string
}

// Custom hook for table state notifications
function useTableNotifications<TData extends DataWithId>({
  rowSelection,
  sorting,
  data,
  onRowSelectionChange,
  onSortingChange,
  enableRowSelection,
}: {
  rowSelection: RowSelectionState
  sorting: SortingState
  data: TData[]
  onRowSelectionChange?: (selectedRows: TData[]) => void
  onSortingChange?: (sorting: SortingState) => void
  enableRowSelection: boolean
}) {
  // Notify parent when row selection changes
  React.useEffect(() => {
    if (!onRowSelectionChange || !enableRowSelection) return
    
    const selectedRows = Object.entries(rowSelection)
      .filter(([_, isSelected]) => isSelected)
      .map(([index]) => data[parseInt(index)])
      .filter((row): row is TData => Boolean(row))
    
    onRowSelectionChange(selectedRows)
  }, [rowSelection, onRowSelectionChange, enableRowSelection, data])

  // Notify parent when sorting changes
  React.useEffect(() => {
    onSortingChange?.(sorting)
  }, [sorting, onSortingChange])
}

export function DataTable<TData extends DataWithId, TValue>({
  columns,
  data,
  loading = false,
  enableRowSelection = false,
  onRowSelectionChange,
  onSortingChange,
  emptyMessage = "No results found.",
  loadingMessage = "Loading...",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  // Use custom hook for notifications
  useTableNotifications({
    rowSelection,
    sorting,
    data,
    onRowSelectionChange,
    onSortingChange,
    enableRowSelection,
  })

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection,
    getRowId: (row) => String(row.id),
    state: {
      sorting,
      rowSelection,
    },
    // Use server-side sorting when available
    manualSorting: true,
  })

  const isEmpty = !loading && table.getRowModel().rows.length === 0
  const showLoading = loading && data.length === 0

  return (
    <div className="data-table-container">
      <Table className="data-table">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {showLoading ? (
            <TableRow>
              <TableCell 
                colSpan={columns.length} 
                className="h-24 text-center text-muted-foreground"
              >
                {loadingMessage}
              </TableCell>
            </TableRow>
          ) : isEmpty ? (
            <TableRow>
              <TableCell 
                colSpan={columns.length} 
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}