'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, XCircle, Clock, RefreshCw } from 'lucide-react';

interface ErrorLog {
  id: string;
  platform: string;
  errorType: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  username?: string;
  retryCount: number;
}

interface ErrorTrackingProps {
  className?: string;
}

export default function ErrorTracking({ className }: ErrorTrackingProps) {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchErrors();
  }, []);

  const fetchErrors = async () => {
    try {
      setLoading(true);
      // Mock data for error tracking
      const mockErrors: ErrorLog[] = [
        {
          id: '1',
          platform: 'Instagram',
          errorType: 'Rate Limit',
          message: 'Rate limit exceeded for Instagram API',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          resolved: false,
          username: 'example_user',
          retryCount: 3
        },
        {
          id: '2',
          platform: 'TikTok',
          errorType: 'Scraping Failed',
          message: 'Failed to scrape TikTok profile - selector not found',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          resolved: true,
          username: 'tiktok_user',
          retryCount: 1
        },
        {
          id: '3',
          platform: 'YouTube',
          errorType: 'API Error',
          message: 'YouTube API quota exceeded',
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          resolved: false,
          retryCount: 0
        }
      ];
      
      setErrors(mockErrors);
    } catch (err) {
      setError('Failed to fetch error logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getErrorColor = (errorType: string) => {
    switch (errorType) {
      case 'Rate Limit': return 'text-yellow-600';
      case 'Scraping Failed': return 'text-red-600';
      case 'API Error': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getErrorIcon = (errorType: string) => {
    switch (errorType) {
      case 'Rate Limit': return <Clock className="h-4 w-4" />;
      case 'Scraping Failed': return <XCircle className="h-4 w-4" />;
      case 'API Error': return <AlertTriangle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const activeErrors = errors.filter(e => !e.resolved);
  const resolvedErrors = errors.filter(e => e.resolved);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Error Tracking</h3>
        <button
          onClick={fetchErrors}
          className="text-blue-600 hover:text-blue-800"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Errors</p>
                <p className="text-2xl font-bold text-red-600">{activeErrors.length}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Resolved Today</p>
                <p className="text-2xl font-bold text-green-600">{resolvedErrors.length}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Errors */}
      {activeErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Active Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeErrors.map((errorLog) => (
                <div key={errorLog.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={getErrorColor(errorLog.errorType)}>
                        {getErrorIcon(errorLog.errorType)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{errorLog.platform}</Badge>
                          <Badge variant="destructive">{errorLog.errorType}</Badge>
                          {errorLog.username && (
                            <span className="text-sm text-gray-600">@{errorLog.username}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 mb-1">{errorLog.message}</p>
                        <p className="text-xs text-gray-500">
                          {formatTime(errorLog.timestamp)} • {getTimeAgo(errorLog.timestamp)}
                          {errorLog.retryCount > 0 && ` • ${errorLog.retryCount} retries`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Resolved Errors */}
      {resolvedErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-green-600" />
              Recently Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resolvedErrors.slice(0, 3).map((errorLog) => (
                <div key={errorLog.id} className="border rounded-lg p-3 bg-green-50">
                  <div className="flex items-start gap-3">
                    <div className="text-green-600">
                      {getErrorIcon(errorLog.errorType)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{errorLog.platform}</Badge>
                        <Badge variant="secondary">{errorLog.errorType}</Badge>
                        {errorLog.username && (
                          <span className="text-sm text-gray-600">@{errorLog.username}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 mb-1">{errorLog.message}</p>
                      <p className="text-xs text-gray-500">
                        Resolved {getTimeAgo(errorLog.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {errors.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <RefreshCw className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p className="text-gray-500">No errors detected</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}