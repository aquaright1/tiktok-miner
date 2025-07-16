"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ExternalLink } from "lucide-react"
import { Creator } from "@/lib/types/creator"
import { Checkbox } from "@/components/ui/checkbox"

// Utility functions (reused from columns-with-actions)
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

const formatNumber = (num: number) => {
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

export const createFinderColumns = (): ColumnDef<Creator>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
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
        {formatNumber(row.getValue("followerCount") as number)}
      </div>
    )
  },
  {
    accessorKey: "avgLikesPerPost",
    header: createSortableHeader("Average Likes"),
    cell: ({ row }) => {
      const profile = row.original
      // Get average likes per post/video depending on platform
      const avgLikes = profile.avgLikesPerPost || profile.avgLikesPerVideo || 0
      return (
        <div className="font-medium text-pink-600">
          {formatNumber(avgLikes)}
        </div>
      )
    }
  },
  {
    accessorKey: "posts",
    header: createSortableHeader("Posts"),
    cell: ({ row }) => {
      const profile = row.original
      // Map different platform fields to posts count
      let postCount = 0
      
      if (profile.platform === 'tiktok') {
        postCount = profile.videoCount || profile.postCount || 0
      } else if (profile.platform === 'instagram') {
        postCount = profile.postCount || profile.videoCount || 0
      } else {
        // Default fallback
        postCount = profile.postCount || profile.videoCount || 0
      }
      
      return (
        <div className="font-medium">
          {formatNumber(postCount)}
        </div>
      )
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
  }
]

// Backward compatibility
export const createScraperColumns = createFinderColumns