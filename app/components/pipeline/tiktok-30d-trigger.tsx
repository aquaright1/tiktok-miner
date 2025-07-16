"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, TrendingUp, RefreshCw } from "lucide-react";

export function TikTok30DayTrigger() {
  const [profiles, setProfiles] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const profileList = profiles
      .split(/[\n,]+/)
      .map(p => p.trim().replace('@', ''))
      .filter(p => p.length > 0);
    
    if (profileList.length === 0) {
      toast.error("Please provide at least one TikTok handle");
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch("/api/pipeline/tiktok-30d", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profiles: profileList
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start pipeline");
      }

      setRunId(data.runId);
      toast.success(`Started processing ${data.profileCount} profiles`);
      
      // Clear form
      setProfiles("");
    } catch (error: any) {
      toast.error(error.message || "Failed to start pipeline");
    } finally {
      setIsLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!runId) return;

    try {
      const response = await fetch(`/api/pipeline/tiktok-30d?runId=${runId}`);
      const data = await response.json();

      if (data.success) {
        toast.info(`Status: ${data.status}`);
        if (data.stats) {
          toast.info(`Processed: ${data.stats.itemsTotal || 0} videos`);
        }
      }
    } catch (error) {
      toast.error("Failed to check status");
    }
  };

  const viewResults = async () => {
    try {
      const response = await fetch("/api/pipeline/tiktok-30d");
      const data = await response.json();

      if (data.success && data.profiles) {
        console.log("TikTok 30-day profiles:", data.profiles);
        toast.success(`Found ${data.count} profiles in database`);
      }
    } catch (error) {
      toast.error("Failed to fetch results");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold mb-2">TikTok 30-Day Engagement Metrics</h3>
        <p className="text-sm text-muted-foreground">
          Analyze the last 30 days of engagement metrics for TikTok profiles.
          Get total likes, comments, views, and shares for videos published in the past month.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profiles">TikTok Handles (one per line or comma-separated)</Label>
          <Textarea
            id="profiles"
            placeholder="garyvee&#10;openai&#10;techjobsdaily&#10;@charliedamelio"
            value={profiles}
            onChange={(e) => setProfiles(e.target.value)}
            disabled={isLoading}
            rows={6}
          />
          <p className="text-xs text-muted-foreground">
            Enter TikTok usernames (with or without @). The pipeline will analyze videos from the last 30 days.
          </p>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                Analyze Profiles
              </>
            )}
          </Button>

          {runId && (
            <Button
              type="button"
              variant="outline"
              onClick={checkStatus}
              disabled={isLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Check Status
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={viewResults}
            disabled={isLoading}
          >
            View Results
          </Button>
        </div>
      </form>

      {runId && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium">Run ID:</p>
          <code className="text-xs">{runId}</code>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
        <h4 className="text-sm font-semibold mb-2">What this pipeline does:</h4>
        <ul className="text-xs space-y-1 list-disc list-inside">
          <li>Scrapes videos published in the last 30 days for each profile</li>
          <li>Aggregates total likes, comments, views, and shares</li>
          <li>Updates the database with fresh 30-day rolling metrics</li>
          <li>Can be scheduled to run daily for continuous monitoring</li>
        </ul>
      </div>
    </div>
  );
}