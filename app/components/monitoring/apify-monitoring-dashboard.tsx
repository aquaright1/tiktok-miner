'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  DollarSign,
  Database,
  Zap
} from 'lucide-react';
import PerformanceAnalytics from './performance-analytics';

interface ApifyMonitoringDashboardProps {
  refreshInterval?: number;
  timeRange?: {
    from: Date;
    to: Date;
  };
}

interface DashboardData {
  overview: {
    totalRuns: number;
    activeRuns: number;
    successRate: number;
    totalCost: number;
    avgResponseTime: number;
    dataQualityScore: number;
  };
  platformMetrics: Array<{
    platform: string;
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    successRate: number;
    avgDuration: number;
    totalCost: number;
    avgCostPerRun: number;
  }>;
  recentRuns: Array<{
    id: string;
    platform: string;
    status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
    startedAt: Date;
    finishedAt?: Date;
    duration?: number;
    datasetItemCount?: number;
    costUsd?: number;
    errorMessage?: string;
  }>;
  alerts: Array<{
    id: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    platform: string;
    timestamp: Date;
    isResolved: boolean;
  }>;
  costAnalysis: {
    dailyCosts: Array<{ date: string; cost: number; runs: number }>;
    platformCosts: Array<{ platform: string; cost: number; percentage: number }>;
    projectedMonthlyCost: number;
    costOptimizationTips: string[];
  };
  dataQualityMetrics: Array<{
    platform: string;
    totalItemsProcessed: number;
    validItemsCount: number;
    invalidItemsCount: number;
    duplicateItemsCount: number;
    dataCompleteness: number;
  }>;
}

export default function ApifyMonitoringDashboard({ 
  refreshInterval = 30000, 
  timeRange 
}: ApifyMonitoringDashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, timeRange]);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (timeRange) {
        params.append('from', timeRange.from.toISOString());
        params.append('to', timeRange.to.toISOString());
      }
      
      const response = await fetch(`/api/monitoring/apify/dashboard?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setDashboardData(result.data);
      } else {
        setError(result.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError('Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCEEDED': return 'bg-green-500';
      case 'RUNNING': return 'bg-blue-500';
      case 'FAILED': return 'bg-red-500';
      case 'TIMED_OUT': return 'bg-yellow-500';
      case 'ABORTED': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW': return 'text-blue-600';
      case 'MEDIUM': return 'text-yellow-600';
      case 'HIGH': return 'text-orange-600';
      case 'CRITICAL': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Apify Monitoring Dashboard</h1>
          <p className="text-gray-600">Real-time monitoring of scraping operations</p>
        </div>
        <Button onClick={fetchDashboardData} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.overview.totalRuns}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Runs</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.overview.activeRuns}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.overview.successRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(dashboardData.overview.totalCost)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(dashboardData.overview.avgResponseTime)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.overview.dataQualityScore.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="quality">Data Quality</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Platform Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.platformMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="platform" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="successRate" fill="#10b981" name="Success Rate %" />
                    <Bar dataKey="totalRuns" fill="#3b82f6" name="Total Runs" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Runs */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Runs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboardData.recentRuns.slice(0, 8).map((run) => (
                    <div key={run.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(run.status)}`} />
                        <span className="text-sm font-medium">{run.platform}</span>
                        <Badge variant="outline">{run.status}</Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {run.duration ? formatDuration(run.duration) : 'Running...'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Platform Metrics Table */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Platform</th>
                        <th className="text-left p-2">Runs</th>
                        <th className="text-left p-2">Success Rate</th>
                        <th className="text-left p-2">Avg Duration</th>
                        <th className="text-left p-2">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.platformMetrics.map((metric) => (
                        <tr key={metric.platform} className="border-b">
                          <td className="p-2 font-medium">{metric.platform}</td>
                          <td className="p-2">{metric.totalRuns}</td>
                          <td className="p-2">{metric.successRate.toFixed(1)}%</td>
                          <td className="p-2">{formatDuration(metric.avgDuration)}</td>
                          <td className="p-2">{formatCost(metric.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Success Rate Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Success Rate by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.platformMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="platform" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="successRate" fill="#10b981" name="Success Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <PerformanceAnalytics 
            timeRange={timeRange}
            refreshInterval={refreshInterval}
          />
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Costs */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dashboardData.costAnalysis.dailyCosts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="cost" stroke="#3b82f6" name="Cost ($)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Platform Costs */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Costs Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dashboardData.costAnalysis.platformCosts}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ platform, percentage }) => `${platform}: ${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="cost"
                    >
                      {dashboardData.costAnalysis.platformCosts.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost Optimization Tips */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Cost Optimization Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="font-medium">Projected Monthly Cost: {formatCost(dashboardData.costAnalysis.projectedMonthlyCost)}</div>
                  </div>
                  {dashboardData.costAnalysis.costOptimizationTips.map((tip, index) => (
                    <div key={index} className="p-3 bg-yellow-50 rounded">
                      <div className="text-sm">{tip}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Data Quality by Platform */}
            <Card>
              <CardHeader>
                <CardTitle>Data Quality by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.dataQualityMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="platform" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="dataCompleteness" fill="#10b981" name="Data Completeness %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Data Quality Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Data Quality Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Platform</th>
                        <th className="text-left p-2">Total Items</th>
                        <th className="text-left p-2">Valid</th>
                        <th className="text-left p-2">Invalid</th>
                        <th className="text-left p-2">Duplicates</th>
                        <th className="text-left p-2">Quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.dataQualityMetrics.map((metric) => (
                        <tr key={metric.platform} className="border-b">
                          <td className="p-2 font-medium">{metric.platform}</td>
                          <td className="p-2">{metric.totalItemsProcessed}</td>
                          <td className="p-2 text-green-600">{metric.validItemsCount}</td>
                          <td className="p-2 text-red-600">{metric.invalidItemsCount}</td>
                          <td className="p-2 text-yellow-600">{metric.duplicateItemsCount}</td>
                          <td className="p-2">{metric.dataCompleteness.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.alerts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2" />
                    <p>No active alerts</p>
                  </div>
                ) : (
                  dashboardData.alerts.map((alert) => (
                    <div key={alert.id} className="border rounded p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className={`h-5 w-5 mt-0.5 ${getSeverityColor(alert.severity)}`} />
                          <div>
                            <div className="font-medium">{alert.message}</div>
                            <div className="text-sm text-gray-500">
                              {alert.platform} • {new Date(alert.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : 'secondary'}>
                          {alert.severity}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}