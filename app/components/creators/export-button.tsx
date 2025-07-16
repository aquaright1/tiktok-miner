'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import ExportDialog from './export-dialog'

interface ExportButtonProps {
  selectedCreatorIds: string[]
  disabled?: boolean
  onExportComplete?: () => void
}

export default function ExportButton({
  selectedCreatorIds,
  disabled = false,
  onExportComplete
}: ExportButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleClick = () => {
    if (selectedCreatorIds.length === 0) {
      return
    }
    setDialogOpen(true)
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={disabled || selectedCreatorIds.length === 0}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        Export ({selectedCreatorIds.length})
      </Button>

      <ExportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        creatorIds={selectedCreatorIds}
        onExportComplete={onExportComplete}
      />
    </>
  )
}