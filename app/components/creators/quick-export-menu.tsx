'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ExportFormat } from '@/lib/export'

interface QuickExportMenuProps {
  creatorId: string
  creatorName: string
}

export default function QuickExportMenu({ creatorId, creatorName }: QuickExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true)
    setExportingFormat(format)

    try {
      const response = await fetch('/api/creators/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorIds: [creatorId],
          format
        })
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const filename = `${creatorName.replace(/\s+/g, '-')}-${format}-export.${format}`
      
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success(`Exported ${creatorName} data as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export creator data')
    } finally {
      setIsExporting(false)
      setExportingFormat(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="ml-2">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleExport('csv')}
          disabled={isExporting}
        >
          <FileText className="mr-2 h-4 w-4" />
          Export as CSV
          {exportingFormat === 'csv' && (
            <Loader2 className="ml-auto h-4 w-4 animate-spin" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport('json')}
          disabled={isExporting}
        >
          <FileJson className="mr-2 h-4 w-4" />
          Export as JSON
          {exportingFormat === 'json' && (
            <Loader2 className="ml-auto h-4 w-4 animate-spin" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport('excel')}
          disabled={isExporting}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export as Excel
          {exportingFormat === 'excel' && (
            <Loader2 className="ml-auto h-4 w-4 animate-spin" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}