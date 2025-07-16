"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ExternalLink, Trash2 } from "lucide-react"
import { Creator } from "@/lib/types/creator"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

// Utility functions
const getPlatformColor = (platform: string) => {
  const colors = {
    tiktok: 'text-pink-600 dark:text-pink-400 hover:text-pink-800 dark:hover:text-pink-300',
    instagram: 'text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300'
  }
  return colors[platform] || 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
}

const getPlatformDisplay = (platform: string) => {
  const displays = {
    tiktok: { name: 'TikTok', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
    instagram: { name: 'Instagram', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' }
  }
  return displays[platform] || { name: platform, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' }
}

const formatNumber = (num: number | null | undefined) => {
  if (!num || isNaN(num)) return '0'
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

const createSortableHeader = (label: string) => ({ column }) => (
  <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
    {label}
    <ArrowUpDown className="ml-2 h-4 w-4" />
  </Button>
)

const DeleteCell = ({ creator, onDelete }: { creator: Creator; onDelete: () => void }) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/creators/${creator.id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete creator')
      }
      
      toast.success(`Deleted @${creator.username}`)
      onDelete()
    } catch (error) {
      toast.error('Failed to delete creator')
      console.error('Delete error:', error)
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDeleteDialog(true)}
        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Creator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete @{creator.username}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export const createColumns = (onDelete: () => void): ColumnDef<Creator>[] => [
  {
    accessorKey: "profileUrl",
    header: "Profile",
    cell: ({ row }) => {
      const profileUrl = row.getValue("profileUrl") as string
      const platform = row.original.platform
      const username = row.original.username
      
      if (!profileUrl) return null
      
      
      return (
        <div className="flex items-center gap-2">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1 transition-colors ${getPlatformColor(platform)}`}
            title={`View ${platform} profile`}
          >
            <span className="font-mono text-sm">@{username}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )
    }
  },
  {
    accessorKey: "platform",
    header: "Platform",
    cell: ({ row }) => {
      const platform = row.getValue("platform") as string
      
      const platformInfo = getPlatformDisplay(platform)
      
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${platformInfo.color}`}>
          {platformInfo.name}
        </span>
      )
    }
  },
  {
    accessorKey: "followerCount",
    header: createSortableHeader("Followers"),
    cell: ({ row }) => (
      <div className="font-medium">
        {formatNumber(row.getValue("followerCount") as number | null | undefined)}
      </div>
    )
  },
  {
    accessorKey: "avgLikesPerPost",
    header: createSortableHeader("Average Likes"),
    cell: ({ row }) => {
      const avgLikes = row.getValue("avgLikesPerPost") as number
      const followerCount = row.original.followerCount as number
      
      // If avgLikes is 0 but creator has followers, show estimated value
      let displayValue = avgLikes;
      if ((!avgLikes || avgLikes === 0) && followerCount > 100) {
        displayValue = Math.round(followerCount * 0.02); // 2% fallback estimate
      }
      
      return (
        <div className="font-medium text-pink-600">
          {formatNumber(displayValue)}
          {displayValue !== avgLikes && (
            <span className="text-xs text-muted-foreground ml-1">*</span>
          )}
        </div>
      )
    }
  },
  {
    accessorKey: "postCount",
    header: createSortableHeader("Posts"),
    cell: ({ row }) => {
      const postCount = row.getValue("postCount") as number;
      return (
        <div className="font-medium">
          {postCount ? postCount.toString() : "0"}
        </div>
      );
    }
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const tags = row.getValue("tags") as string[]
      
      if (!tags || tags.length === 0) {
        return <span className="text-muted-foreground text-sm">No tags</span>
      }
      
      return (
        <div className="flex flex-wrap gap-1 max-w-[300px]">
          {tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{tags.length - 3} more
            </span>
          )}
        </div>
      )
    }
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <DeleteCell creator={row.original} onDelete={onDelete} />
    )
  }
]