'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CREATOR_EXPORT_FIELDS, ExportField, ExportFormat } from '@/lib/export'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  creatorIds: string[]
  onExportComplete?: () => void
}

export default function ExportDialog({
  open,
  onOpenChange,
  creatorIds,
  onExportComplete
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [selectedFields, setSelectedFields] = useState<string[]>(
    CREATOR_EXPORT_FIELDS.map(f => f.key)
  )
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [jobId, setJobId] = useState<string | null>(null)

  const formatOptions = [
    { value: 'csv', label: 'CSV', icon: FileText, description: 'Comma-separated values' },
    { value: 'json', label: 'JSON', icon: FileJson, description: 'JavaScript Object Notation' },
    { value: 'excel', label: 'Excel', icon: FileSpreadsheet, description: 'Microsoft Excel format' }
  ]

  const handleFieldToggle = (fieldKey: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldKey)
        ? prev.filter(k => k !== fieldKey)
        : [...prev, fieldKey]
    )
  }

  const handleSelectAll = () => {
    setSelectedFields(CREATOR_EXPORT_FIELDS.map(f => f.key))
  }

  const handleSelectNone = () => {
    setSelectedFields([])
  }

  const handleExport = async () => {
    if (selectedFields.length === 0) {
      toast.error('Please select at least one field to export')
      return
    }

    setIsExporting(true)
    setExportProgress(0)

    try {
      const fields = CREATOR_EXPORT_FIELDS.filter(f => selectedFields.includes(f.key))
      
      const response = await fetch('/api/creators/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorIds,
          format,
          fields
        })
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Check if it's a file download or a job response
      const contentType = response.headers.get('content-type')
      
      if (contentType && contentType.includes('application/json')) {
        // It's a job - poll for status
        const data = await response.json()
        if (data.jobId) {
          setJobId(data.jobId)
          pollJobStatus(data.jobId)
        }
      } else {
        // Direct file download
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const filename = getFilenameFromResponse(response) || `export.${format}`
        
        downloadFile(url, filename)
        
        toast.success('Export completed successfully')
        onExportComplete?.()
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export data')
    } finally {
      if (!jobId) {
        setIsExporting(false)
      }
    }
  }

  const pollJobStatus = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/creators/export?jobId=${jobId}`)
        const job = await response.json()

        setExportProgress(job.progress || 0)

        if (job.status === 'completed') {
          clearInterval(pollInterval)
          
          if (job.downloadUrl) {
            downloadFile(job.downloadUrl, `export.${format}`)
          }
          
          toast.success('Export completed successfully')
          onExportComplete?.()
          onOpenChange(false)
          setIsExporting(false)
          setJobId(null)
        } else if (job.status === 'failed') {
          clearInterval(pollInterval)
          toast.error(job.error || 'Export failed')
          setIsExporting(false)
          setJobId(null)
        }
      } catch (error) {
        clearInterval(pollInterval)
        toast.error('Failed to check export status')
        setIsExporting(false)
        setJobId(null)
      }
    }, 1000)
  }

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }

  const getFilenameFromResponse = (response: Response): string | null => {
    const disposition = response.headers.get('content-disposition')
    if (disposition) {
      const match = disposition.match(/filename="(.+)"/)
      return match ? match[1] : null
    }
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Creator Data</DialogTitle>
          <DialogDescription>
            Export {creatorIds.length} selected creator{creatorIds.length !== 1 ? 's' : ''} to your preferred format
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              {formatOptions.map(option => {
                const Icon = option.icon
                return (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label
                      htmlFor={option.value}
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{option.label}</span>
                      <span className="text-sm text-muted-foreground">
                        - {option.description}
                      </span>
                    </Label>
                  </div>
                )
              })}
            </RadioGroup>
          </div>

          {/* Field Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Select Fields to Export</Label>
              <div className="space-x-2">
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  Select All
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleSelectNone}
                >
                  Clear All
                </Button>
              </div>
            </div>
            <ScrollArea className="h-[200px] border rounded-md p-4">
              <div className="space-y-2">
                {CREATOR_EXPORT_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={field.key}
                      checked={selectedFields.includes(field.key)}
                      onCheckedChange={() => handleFieldToggle(field.key)}
                    />
                    <Label
                      htmlFor={field.key}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {field.label}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Progress */}
          {isExporting && jobId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Exporting...</span>
                <span>{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedFields.length === 0}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}