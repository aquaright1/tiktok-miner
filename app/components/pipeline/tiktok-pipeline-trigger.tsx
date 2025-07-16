"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Search, Users } from "lucide-react";

export function TikTokPipelineTrigger() {
  const [searchQuery, setSearchQuery] = useState("");
  const [keywords, setKeywords] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pipelineId, setPipelineId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim() || !keywords.trim()) {
      toast.error("Please provide both search query and keywords");
      return;
    }

    setIsLoading(true);
    
    try {
      const keywordArray = keywords
        .split(",")
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const response = await fetch("/api/pipeline/tiktok", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          searchQuery: searchQuery.trim(),
          keywords: keywordArray,
          useGoogleSearch: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start pipeline");
      }

      setPipelineId(data.pipelineId);
      toast.success("TikTok recruiting pipeline started!");
      
      // Clear form
      setSearchQuery("");
      setKeywords("");
    } catch (error: any) {
      toast.error(error.message || "Failed to start pipeline");
    } finally {
      setIsLoading(false);
    }
  };

  const checkPipelineStatus = async () => {
    if (!pipelineId) return;

    try {
      const response = await fetch(`/api/pipeline/tiktok?pipelineId=${pipelineId}`);
      const data = await response.json();

      if (data.success) {
        toast.info(`Pipeline status: ${data.status} (Stage: ${data.pipeline.stage})`);
      }
    } catch (error) {
      toast.error("Failed to check pipeline status");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold mb-2">TikTok Recruiting Pipeline</h3>
        <p className="text-sm text-muted-foreground">
          Search for TikTok profiles and filter by bio keywords to find recruiting candidates.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="searchQuery">Search Query</Label>
          <Input
            id="searchQuery"
            placeholder="e.g., tech recruiter, HR manager, talent acquisition"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            This query will be used to search Google/TikTok for relevant profiles
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="keywords">Bio Keywords (comma-separated)</Label>
          <Textarea
            id="keywords"
            placeholder="e.g., recruiter, hiring, HR, talent, careers, jobs"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            disabled={isLoading}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Profiles will be filtered to only include those with these keywords in their bio
          </p>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Pipeline...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Start Pipeline
              </>
            )}
          </Button>

          {pipelineId && (
            <Button
              type="button"
              variant="outline"
              onClick={checkPipelineStatus}
              disabled={isLoading}
            >
              <Users className="mr-2 h-4 w-4" />
              Check Status
            </Button>
          )}
        </div>
      </form>

      {pipelineId && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium">Pipeline ID:</p>
          <code className="text-xs">{pipelineId}</code>
        </div>
      )}
    </div>
  );
}