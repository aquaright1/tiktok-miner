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

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  enableRowSelection?: boolean
  onRowSelectionChange?: (selectedRowIds: string[]) => void
  onSortingChange?: (sorting: SortingState) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading,
  enableRowSelection = false,
  onRowSelectionChange,
  onSortingChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  // Notify parent component when row selection changes
  React.useEffect(() => {
    if (onRowSelectionChange && enableRowSelection) {
      const selectedRowIds = Object.keys(rowSelection).filter(key => rowSelection[key])
        .map(index => data[parseInt(index)]?.id).filter(Boolean)
      onRowSelectionChange(selectedRowIds)
    }
  }, [rowSelection, onRowSelectionChange, enableRowSelection, data])

  // Notify parent component when sorting changes
  React.useEffect(() => {
    if (onSortingChange) {
      onSortingChange(sorting)
    }
  }, [sorting, onSortingChange])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection,
    getRowId: (row: any) => row.id,
    state: {
      sorting,
      rowSelection,
    },
    // Don't use client-side sorting when server-side sorting is available
    manualSorting: true,
  })

  return (
    <div className="data-table-container">
      <table className="data-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td 
                colSpan={columns.length} 
                className="h-24 text-center text-muted-foreground"
              >
                {loading ? "Loading..." : "No creators found."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}