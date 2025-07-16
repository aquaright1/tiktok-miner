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
    instagram: 'text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300',
    youtube: 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300',
    twitter: 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
  }
  return colors[platform] || 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
}

const getPlatformDisplay = (platform: string) => {
  const displays = {
    tiktok: { name: 'TikTok', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
    instagram: { name: 'Instagram', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    youtube: { name: 'YouTube', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    twitter: { name: 'Twitter', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' }
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

export const columns: ColumnDef<Creator>[] = [
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
            <span className="font-mono text-xs">@{username}</span>
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
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
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs text-sm ${platformInfo.color}`}>
          {platformInfo.name}
        </span>
      )
    }
  },
  {
    accessorKey: "followerCount",
    header: createSortableHeader("Followers"),
    cell: ({ row }) => (
      <div className="text-sm text-center">
        {formatNumber(row.getValue("followerCount") as number)}
      </div>
    )
  },
  {
    accessorKey: "avgLikesPerPost",
    header: createSortableHeader("Avg Likes"),
    cell: ({ row }) => {
      const avgLikes = row.getValue("avgLikesPerPost") as number
      return (
        <div className="text-sm text-pink-600 text-center">
          {formatNumber(avgLikes)}
        </div>
      )
    }
  },
  {
    accessorKey: "postCount",
    header: createSortableHeader("Posts"),
    cell: ({ row }) => {
      const postCount = row.getValue("postCount") as number
      return (
        <div className="text-sm text-center">
          {postCount ? postCount.toString() : "0"}
        </div>
      )
    }
  },
  {
    accessorKey: "engagementRate",
    header: createSortableHeader("Gem Score"),
    cell: ({ row }) => {
      const engagementRate = row.getValue("engagementRate") as number | null | undefined
      
      if (engagementRate === undefined || engagementRate === null) {
        return <div className="text-muted-foreground text-center">-</div>
      }
      
      return (
        <div className="text-sm text-center">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs text-sm bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            {engagementRate.toFixed(2)}%
          </span>
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
        <div className="flex flex-wrap gap-1 max-w-[150px]">
          {tags.slice(0, 1).map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {tag.length > 15 ? tag.substring(0, 15) + '...' : tag}
            </span>
          ))}
          {tags.length > 1 && (
            <span className="text-xs text-muted-foreground">
              +{tags.length - 1}
            </span>
          )}
        </div>
      )
    }
  }
]