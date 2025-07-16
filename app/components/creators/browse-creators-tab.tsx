"use client"

import React, { useEffect, useState, useMemo } from "react"
import { DataTable } from "@/components/creators/data-table"
import { tiktokColumns } from "@/components/creators/tiktok-columns"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download } from "lucide-react"
import { AddCreatorDialog } from "@/components/creators/add-creator-dialog"
// Fetch function to call API route instead of server action
import useSWR from "swr"

const PAGE_SIZE = 10000 // Large number to fetch all records

export function BrowseCreatorsTab() {
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [minFollowers, setMinFollowers] = useState<number | undefined>(undefined)
  const [maxFollowers, setMaxFollowers] = useState<number | undefined>(undefined)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [sorting, setSorting] = useState<any[]>([])

  // Fetch categories for filtering
  const { data: categoriesData } = useSWR(
    'categories-tiktok',
    async () => {
      const params = new URLSearchParams();
      params.append('table', 'tiktok_profiles');
      const response = await fetch(`/api/creators/categories?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    },
    { revalidateOnFocus: false }
  );

  // Create a stable key for SWR
  const swrKey = JSON.stringify({
    search: searchQuery,
    category: categoryFilter,
    minFollowers,
    maxFollowers,
    pageSize: PAGE_SIZE,
    sorting,
  });

  // Fetch creators using SWR
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const search = searchQuery;
      const category = categoryFilter;
      const pageSize = PAGE_SIZE;
      // Build query parameters
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category && category !== 'all') params.append('category', category);
      if (minFollowers) params.append('minFollowers', minFollowers.toString());
      if (maxFollowers) params.append('maxFollowers', maxFollowers.toString());
      params.append('limit', pageSize.toString());
      params.append('offset', '0');
      params.append('table', 'tiktok_profiles');
      
      // Add sorting parameters
      if (sorting && sorting.length > 0) {
        const sort = sorting[0];
        params.append('sortBy', sort.id);
        params.append('sortOrder', sort.desc ? 'desc' : 'asc');
      }
      
      // Call the API route
      const response = await fetch(`/api/creators?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch creators');
      }
      const result = await response.json();
      
      // Transform API response to match expected format
      return {
        creators: result.creators || [],
        total: result.total || 0,
        pageSize
      };
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 0, // Don't dedupe requests
    }
  )

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }


  const handleCategoryChange = (category: string) => {
    setCategoryFilter(category)
  }

  const handleFollowerRangeChange = (values: (number | undefined)[]) => {
    setMinFollowers(values[0])
    setMaxFollowers(values[1])
  }


  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0


  const handleRefresh = async () => {
    setIsRefreshing(true)
    await mutate()
    setIsRefreshing(false)
  }

  const handleSortingChange = (newSorting: any[]) => {
    setSorting(newSorting)
  }

  const handleExportCSV = async () => {
    if (!data?.creators || data.creators.length === 0) {
      return
    }

    setIsExporting(true)
    
    try {
      // Convert data to CSV format
      const creators = data.creators
      const csvHeaders = [
        'Username',
        'Full Name',
        'Followers',
        'Posts (30d)',
        'Views (30d)',
        'Likes (30d)',
        'Comments (30d)',
        'Shares (30d)',
        'Engagement Rate (%)',
        'Verified',
        'Category',
        'Profile URL',
        'Last Updated'
      ]
      
      const csvRows = creators.map(creator => [
        creator.username || '',
        creator.nickName || creator.name || '',
        creator.followerCount || 0,
        creator.posts30d || 0,
        creator.viewsTotal || 0,
        creator.likesTotal || 0,
        creator.commentsTotal || 0,
        creator.sharesTotal || 0,
        creator.engagementRate ? creator.engagementRate.toFixed(2) : '0.00',
        creator.verified ? 'Yes' : 'No',
        creator.category || '',
        creator.profileUrl || '',
        creator.lastSync ? (() => {
          const date = new Date(creator.lastSync)
          const month = date.getMonth() + 1
          const day = date.getDate()
          return `${month}/${day}`
        })() : ''
      ])
      
      // Create CSV content
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => {
          // Escape commas and quotes in fields
          const stringField = String(field)
          if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`
          }
          return stringField
        }).join(','))
      ].join('\n')
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        
        // Generate filename with current date and filters
        const date = new Date().toISOString().split('T')[0]
        const filters = []
        if (searchQuery) filters.push(`search-${searchQuery}`)
        if (categoryFilter !== 'all') filters.push(`category-${categoryFilter}`)
        if (minFollowers) filters.push(`min-${minFollowers}`)
        if (maxFollowers) filters.push(`max-${maxFollowers}`)
        
        const filterString = filters.length > 0 ? `_${filters.join('_')}` : ''
        const filename = `tiktok_creators_${date}${filterString}.csv`
        
        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error exporting CSV:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card className="p-6 relative">
      <div className="space-y-6">
        {/* Header with Refresh Button */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-semibold">Creator Statistics (30 days)</h2>
          </div>
          <div className="flex items-center gap-2">
            <AddCreatorDialog onSuccess={() => mutate()} />
            <Button
              onClick={handleExportCSV}
              disabled={isExporting || !data?.creators || data.creators.length === 0}
              size="sm"
              variant="outline"
            >
              <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Creators</Label>
            <Input
              id="search"
              placeholder="Search by name or username..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>


          {/* Category Filter */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={categoryFilter} onValueChange={handleCategoryChange}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoriesData?.categories?.map((category: string) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Follower Range Filter */}
          <div className="space-y-2">
            <Label>Follower Range</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                placeholder="Min (e.g., 1000)"
                value={minFollowers || ''}
                onChange={(e) => handleFollowerRangeChange([parseInt(e.target.value) || undefined, maxFollowers])}
                className="w-32"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="number"
                placeholder="Max (e.g., 100000)"
                value={maxFollowers || ''}
                onChange={(e) => handleFollowerRangeChange([minFollowers, parseInt(e.target.value) || undefined])}
                className="w-32"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-md border">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Loading creators...</div>
            </div>
          ) : (
            <DataTable
              columns={tiktokColumns}
              data={data?.creators || []}
              loading={isLoading}
              onSortingChange={handleSortingChange}
            />
          )}
        </div>


        {/* Results Count */}
        {data && (
          <div className="text-sm text-muted-foreground">
            Showing {data.creators?.length || 0} creators
          </div>
        )}
      </div>
    </Card>
  )
}