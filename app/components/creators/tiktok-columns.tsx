"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ExternalLink } from "lucide-react"

// Utility functions
const formatNumber = (num: number | string | null | undefined) => {
  // Handle BigInt values from database
  const value = typeof num === 'string' ? parseInt(num) : num;
  
  if (!value || isNaN(value)) return '0'
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toString()
}

const createSortableHeader = (label: string) => ({ column }) => (
  <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
    {label}
    <ArrowUpDown className="ml-2 h-4 w-4" />
  </Button>
)

interface TikTokProfile {
  username: string
  profileUrl: string
  posts30d: number
  likesTotal: number | string
  commentsTotal: number
  viewsTotal: number | string
  sharesTotal: number
  followerCount: number
  nickName?: string
  verified?: boolean
  engagementRate?: number
  category?: string
  lastUpdated?: string | Date
  lastSync?: string | Date
}

export const tiktokColumns: ColumnDef<TikTokProfile>[] = [
  {
    accessorKey: "profileUrl",
    header: "Profile",
    size: 140,
    cell: ({ row }) => {
      const profileUrl = row.getValue("profileUrl") as string
      const username = row.original.username
      const nickName = row.original.nickName
      const verified = row.original.verified
      
      return (
        <div className="flex items-center gap-2">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-0.5 transition-colors text-pink-600 dark:text-pink-400 hover:text-pink-800 dark:hover:text-pink-300"
            title="View TikTok profile"
          >
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs">@{username}</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              {verified && (
                <span className="text-blue-500" title="Verified">✓</span>
              )}
            </div>
            {nickName && nickName !== username && (
              <span className="text-xs text-muted-foreground">{nickName}</span>
            )}
          </a>
        </div>
      )
    }
  },
  {
    accessorKey: "engagementRate",
    header: createSortableHeader("Gem Score"),
    size: 100,
    cell: ({ row }) => {
      const engagementRate = row.getValue("engagementRate") as number | null | undefined
      
      if (engagementRate === undefined || engagementRate === null) {
        return <div className="text-muted-foreground text-center">-</div>
      }
      
      return (
        <div className="text-center font-mono">
          {engagementRate.toFixed(2)}
        </div>
      )
    }
  },
  {
    accessorKey: "followerCount",
    header: createSortableHeader("Followers"),
    size: 80,
    cell: ({ row }) => {
      const followers = row.getValue("followerCount") as number
      
      return (
        <div className="text-sm text-center">
          {formatNumber(followers)}
        </div>
      )
    }
  },
  {
    accessorKey: "posts30d",
    header: createSortableHeader("Posts"),
    size: 70,
    cell: ({ row }) => {
      const posts = row.getValue("posts30d") as number
      return (
        <div className="text-sm text-center">
          {posts || 0}
        </div>
      )
    }
  },
  {
    accessorKey: "likesTotal",
    header: createSortableHeader("Likes"),
    size: 70,
    cell: ({ row }) => {
      const likes = row.getValue("likesTotal") as number | string
      return (
        <div className="text-sm text-pink-600 text-center">
          {formatNumber(likes)}
        </div>
      )
    }
  },
  {
    accessorKey: "commentsTotal",
    header: createSortableHeader("Comments"),
    size: 80,
    cell: ({ row }) => {
      const comments = row.getValue("commentsTotal") as number
      return (
        <div className="text-sm text-blue-600 text-center">
          {formatNumber(comments)}
        </div>
      )
    }
  },
  {
    accessorKey: "viewsTotal",
    header: createSortableHeader("Views"),
    size: 70,
    cell: ({ row }) => {
      const views = row.getValue("viewsTotal") as number | string
      return (
        <div className="text-sm text-green-600 text-center">
          {formatNumber(views)}
        </div>
      )
    }
  },
  {
    accessorKey: "sharesTotal",
    header: createSortableHeader("Shares"),
    size: 70,
    cell: ({ row }) => {
      const shares = row.getValue("sharesTotal") as number
      return (
        <div className="text-sm text-purple-600 text-center">
          {formatNumber(shares)}
        </div>
      )
    }
  },
  {
    accessorKey: "category",
    header: createSortableHeader("Category"),
    size: 120,
    cell: ({ row }) => {
      const category = row.getValue("category") as string | null | undefined
      
      if (!category) {
        return <div className="text-muted-foreground text-center">-</div>
      }
      
      return (
        <div className="text-center">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {category}
          </span>
        </div>
      )
    }
  },
  {
    accessorKey: "lastSync",
    header: createSortableHeader("Last Updated"),
    size: 100,
    cell: ({ row }) => {
      const lastSync = row.getValue("lastSync") as string | Date | null | undefined
      
      if (!lastSync) {
        return <div className="text-muted-foreground text-center">-</div>
      }
      
      const date = new Date(lastSync)
      const month = date.getMonth() + 1
      const day = date.getDate()
      
      return (
        <div className="text-sm text-center font-mono">
          {month}/{day}
        </div>
      )
    }
  }
]