"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTable } from "@/components/creators/data-table"
import { createFinderColumns } from "@/components/creators/scraper-columns"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { Creator } from "@/lib/types/creator"
import { Terminal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { StreamingClient } from "@/lib/streaming-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { FinderErrorBoundary } from "@/components/scraper/scraper-error-boundary"
import { PipelineStatus } from "@/components/scraper/pipeline-status"

export default function ScraperPage() {
  const [keywords, setKeywords] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState("")
  const [scrapedResults, setScrapedResults] = useState<Creator[]>([])
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [isCachedResult, setIsCachedResult] = useState(false)
  const [cacheInfo, setCacheInfo] = useState<any>(null)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [pipelineMode, setPipelineMode] = useState(false)
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null)
  const [pipelineType, setPipelineType] = useState<'discovery' | 'metrics'>('discovery')
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [showTerminal, setShowTerminal] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const streamingClientRef = useRef<StreamingClient | null>(null)

  const validateKeywords = (keywordList: string[]) => {
    if (keywordList.length === 0) {
      return "Please enter at least one keyword"
    }
    
    if (keywordList.length > 20) {
      return "Maximum 20 keywords allowed"
    }
    
    for (const keyword of keywordList) {
      if (keyword.length < 2) {
        return "Keywords must be at least 2 characters long"
      }
      if (keyword.length > 50) {
        return "Keywords must be less than 50 characters"
      }
      if (!/^[a-zA-Z0-9._\-\s]+$/.test(keyword)) {
        return "Keywords can only contain letters, numbers, spaces, dots, underscores, and hyphens"
      }
    }
    
    return null
  }

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalOutput])

  // Cleanup streaming client on unmount
  useEffect(() => {
    return () => {
      if (streamingClientRef.current) {
        streamingClientRef.current.abort()
      }
    }
  }, [])

  const handleScrape = async () => {
    if (!keywords.trim()) {
      toast.error("Please enter at least one keyword")
      return
    }
    
    const keywordList = keywords.split('\n').map(k => k.trim()).filter(k => k)
    
    const validationError = validateKeywords(keywordList)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setIsLoading(true)
    setLoadingProgress(0)
    setLoadingMessage("Running TikTok pipeline...")
    setTerminalOutput([])
    setShowTerminal(true)
    
    try {
      // Clean up any existing streaming client
      if (streamingClientRef.current) {
        streamingClientRef.current.abort()
      }

      const client = new StreamingClient('/api/scraper/run-pipeline', {
        keywords: keywords
      })

      streamingClientRef.current = client

      await client.connect({
        onOutput: (data) => {
          setTerminalOutput(prev => [...prev, data])
          // Update progress based on output
          if (data.includes('Progress Monitor:')) {
            setLoadingProgress(10)
            setLoadingMessage("Starting pipeline...")
          } else if (data.includes('Found') && data.includes('creator profiles')) {
            setLoadingProgress(30)
            setLoadingMessage("Found creators, starting scrape...")
          } else if (data.includes('Scraping 30-day profile data')) {
            setLoadingProgress(50)
            setLoadingMessage("Scraping profile data...")
          } else if (data.includes('100%')) {
            setLoadingProgress(90)
            setLoadingMessage("Finalizing...")
          }
        },
        onError: (error) => {
          setTerminalOutput(prev => [...prev, `\x1b[31m❌ Error: ${error}\x1b[0m`])
        },
        onProgress: (progress) => {
          setTerminalOutput(prev => [...prev, `\x1b[36m➤ ${progress.status}\x1b[0m`])
        },
        onComplete: (result) => {
          setLoadingProgress(100)
          setLoadingMessage("Pipeline complete!")
          
          if (result.success) {
            toast.success('Pipeline completed successfully')
            // Clear results after successful pipeline run
            setScrapedResults([])
            setKeywords('')
          } else {
            toast.error('Pipeline completed with errors')
          }
          
          setTerminalOutput(prev => [...prev, '', `\x1b[32m✅ Pipeline ${result.success ? 'completed successfully' : 'completed with errors'}\x1b[0m`])
        }
      })
      
    } catch (error) {
      console.error('Pipeline error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to run pipeline')
      setTerminalOutput(prev => [...prev, '', `\x1b[31m❌ Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`])
    } finally {
      setIsLoading(false)
      setLoadingProgress(0)
      setLoadingMessage("")
      streamingClientRef.current = null
    }
  }

  const handleAddSelected = async () => {
    if (selectedRows.size === 0) {
      toast.error("Please select at least one profile to add")
      return
    }

    const selectedProfiles = scrapedResults.filter(profile => 
      selectedRows.has(profile.id)
    )

    try {
      const response = await fetch('/api/scraper/add-selected', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profiles: selectedProfiles
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add selected profiles')
      }

      const result = await response.json()
      toast.success(`Added ${result.added || 0} profiles to creators dashboard`)
      setSelectedRows(new Set())
    } catch (error) {
      console.error('Add selected error:', error)
      toast.error('Failed to add selected profiles')
    }
  }

  const handleClearResults = () => {
    setScrapedResults([])
    setSelectedRows(new Set())
    setIsCachedResult(false)
    setCacheInfo(null)
    toast.success("Results cleared")
  }

  const handleRemoveSelected = () => {
    if (selectedRows.size === 0) {
      toast.error("Please select at least one profile to remove")
      return
    }

    // Show confirmation dialog for bulk operations (>5 profiles)
    if (selectedRows.size > 5) {
      setShowRemoveDialog(true)
      return
    }

    // Direct removal for small selections
    confirmRemoveSelected()
  }

  const confirmRemoveSelected = () => {
    const updatedResults = scrapedResults.filter(profile => 
      !selectedRows.has(profile.id)
    )
    
    setScrapedResults(updatedResults)
    setSelectedRows(new Set())
    setShowRemoveDialog(false)
    
    toast.success(`Removed ${selectedRows.size} profile${selectedRows.size !== 1 ? 's' : ''} from results`)
  }

  const handleRowSelection = (selectedRowIds: string[]) => {
    setSelectedRows(new Set(selectedRowIds))
  }

  const handlePipelineComplete = (results: any[]) => {
    // Transform pipeline results to match the expected Creator format
    const transformedResults = results.map(profile => ({
      id: profile.id || `ig-${profile.username}`,
      username: profile.username,
      name: profile.fullName || profile.username,
      platform: 'instagram' as const,
      followerCount: profile.followersCount || 0,
      postCount: profile.postsCount || 0,
      avgLikesPerPost: profile.avgLikes || 0,
      profileUrl: profile.url || `https://www.instagram.com/${profile.username}/`,
      profilePictureUrl: profile.profilePicUrl || profile.profilePictureUrl,
      bio: profile.biography || '',
      isVerified: profile.verified || false,
      tags: profile.businessCategoryName ? [profile.businessCategoryName] : [],
      engagementRate: profile.followersCount > 0 
        ? ((profile.avgLikes || 0) / profile.followersCount * 100) 
        : 0
    }))

    setScrapedResults(transformedResults)
    setActivePipelineId(null)
    toast.success(`Pipeline completed! Found ${results.length} profiles`)
  }

  return (
    <FinderErrorBoundary>
      <div className="container mx-auto py-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Finder</h1>
          </div>

        {/* Search Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                id="keywords"
                placeholder={pipelineMode && pipelineType === 'metrics' 
                  ? "Enter Instagram handles (e.g., cristiano, therock)..."
                  : "Enter search term..."}
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                disabled={isLoading}
              />
            </div>


            {/* Loading Progress */}
            {isLoading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{loadingMessage}</span>
                  <span className="text-muted-foreground">{loadingProgress}%</span>
                </div>
                <Progress value={loadingProgress} className="w-full" />
              </div>
            )}
            
            <Button 
              onClick={handleScrape}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                  Finding Profiles...
                </>
              ) : (
                'Find Profiles'
              )}
            </Button>
          </div>
        </Card>

        {/* Terminal Output */}
        {showTerminal && (
          <Card className="p-0 overflow-hidden">
            <div className="bg-gray-900 text-gray-100 font-mono text-sm">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  <span className="font-semibold">Finder Output</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowTerminal(false)
                    if (streamingClientRef.current) {
                      streamingClientRef.current.abort()
                    }
                  }}
                  className="h-8 w-8 p-0 hover:bg-gray-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div
                ref={terminalRef}
                className="p-4 h-96 overflow-y-auto bg-gray-900"
                style={{ 
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#4b5563 #1f2937'
                }}
              >
                {terminalOutput.length === 0 ? (
                  <div className="text-gray-500">Waiting for output...</div>
                ) : (
                  terminalOutput.map((line, index) => (
                    <div
                      key={index}
                      className="whitespace-pre-wrap break-all"
                      dangerouslySetInnerHTML={{ 
                        __html: line
                          .replace(/\x1b\[31m/g, '<span style="color: #ef4444">')
                          .replace(/\x1b\[32m/g, '<span style="color: #10b981">')
                          .replace(/\x1b\[33m/g, '<span style="color: #f59e0b">')
                          .replace(/\x1b\[34m/g, '<span style="color: #3b82f6">')
                          .replace(/\x1b\[35m/g, '<span style="color: #a855f7">')
                          .replace(/\x1b\[36m/g, '<span style="color: #06b6d4">')
                          .replace(/\x1b\[0m/g, '</span>')
                          .replace(/\x1b\[1;33m/g, '<span style="color: #fbbf24; font-weight: bold">')
                          .replace(/\x1b\[0;31m/g, '<span style="color: #ef4444">')
                          .replace(/\x1b\[0;32m/g, '<span style="color: #10b981">')
                          .replace(/\x1b\[0;33m/g, '<span style="color: #f59e0b">')
                          .replace(/\x1b\[0;34m/g, '<span style="color: #3b82f6">')
                          .replace(/\x1b\[0;35m/g, '<span style="color: #a855f7">')
                          .replace(/\x1b\[0;36m/g, '<span style="color: #06b6d4">')
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Pipeline Status */}
        {activePipelineId && (
          <PipelineStatus 
            pipelineId={activePipelineId}
            onComplete={handlePipelineComplete}
          />
        )}

        {/* Results Section */}
        {scrapedResults.length > 0 && !activePipelineId && (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">
                      Found Results ({scrapedResults.length})
                    </h2>
                    {isCachedResult && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        🚀 Cached
                      </span>
                    )}
                  </div>
                  {cacheInfo && (
                    <p className="text-xs text-muted-foreground">
                      {isCachedResult 
                        ? `Retrieved from cache (${Math.floor(cacheInfo.age / 60)}m old)`
                        : `Fresh data (cached for future requests)`
                      }
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddSelected}
                    disabled={selectedRows.size === 0}
                    variant="default"
                  >
                    Add Selected ({selectedRows.size})
                  </Button>
                  <Button
                    onClick={handleRemoveSelected}
                    disabled={selectedRows.size === 0}
                    variant="destructive"
                  >
                    Remove Selected ({selectedRows.size})
                  </Button>
                  <Button
                    onClick={handleClearResults}
                    variant="outline"
                  >
                    Clear Results
                  </Button>
                </div>
              </div>

              <div className="rounded-md border">
                <DataTable
                  columns={useMemo(() => createFinderColumns(), [])}
                  data={scrapedResults}
                  loading={false}
                  onRowSelectionChange={handleRowSelection}
                  enableRowSelection={true}
                />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Remove Selected Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Selected Profiles</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to remove {selectedRows.size} profile{selectedRows.size !== 1 ? 's' : ''} from the finder results. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowRemoveDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveSelected}>
              Remove {selectedRows.size} Profile{selectedRows.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </FinderErrorBoundary>
  )
}