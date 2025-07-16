'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ScatterChart,
  Scatter
} from 'recharts';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Zap,
  Clock,
  Target,
  DollarSign,
  BarChart3,
  TrendingUpIcon
} from 'lucide-react';

interface PerformanceAnalyticsProps {
  timeRange?: {
    from: Date;
    to: Date;
  };
  platform?: string;
  refreshInterval?: number;
}

interface PerformanceMetrics {
  platform: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  avgDatasetSize: number;
  avgCostPerRun: number;
  throughputPerHour: number;
  errorRate: number;
  p95Duration: number;
  p99Duration: number;
  successRate: number;
  costEfficiency: number;
  timeEfficiency: number;
}

interface PerformanceTrend {
  date: string;
  platform: string;
  avgDuration: number;
  successRate: number;
  throughput: number;
  errorRate: number;
  costPerItem: number;
}

interface PerformanceBottleneck {
  type: 'duration' | 'error_rate' | 'cost' | 'throughput';
  platform: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  recommendation: string;
  affectedRuns: number;
  estimatedCostImpact: number;
}

interface PerformanceOptimization {
  platform: string;
  optimizationType: 'speed' | 'cost' | 'reliability';
  currentValue: number;
  targetValue: number;
  potentialSavings: number;
  recommendation: string;
  priority: 'low' | 'medium' | 'high';
}

export default function PerformanceAnalytics({
  timeRange,
  platform,
  refreshInterval = 60000
}: PerformanceAnalyticsProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [trends, setTrends] = useState<PerformanceTrend[]>([]);
  const [bottlenecks, setBottlenecks] = useState<PerformanceBottleneck[]>([]);
  const [optimizations, setOptimizations] = useState<PerformanceOptimization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>(platform || 'all');
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week'>('day');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, [timeRange, selectedPlatform, granularity, refreshInterval]);

  const fetchAnalytics = async () => {
    try {
      setError(null);
      
      const params = new URLSearchParams();
      if (timeRange) {
        params.append('from', timeRange.from.toISOString());
        params.append('to', timeRange.to.toISOString());
      }
      if (selectedPlatform !== 'all') {
        params.append('platform', selectedPlatform);
      }
      params.append('granularity', granularity);

      const [metricsRes, trendsRes, bottlenecksRes, optimizationsRes] = await Promise.all([
        fetch(`/api/monitoring/apify/performance?type=metrics&${params}`),
        fetch(`/api/monitoring/apify/performance?type=trends&${params}`),
        fetch(`/api/monitoring/apify/performance?type=bottlenecks&${params}`),
        fetch(`/api/monitoring/apify/performance?type=optimizations&${params}`)
      ]);

      const [metricsData, trendsData, bottlenecksData, optimizationsData] = await Promise.all([
        metricsRes.json(),
        trendsRes.json(),
        bottlenecksRes.json(),
        optimizationsRes.json()
      ]);

      if (metricsData.success) setMetrics(metricsData.data);
      if (trendsData.success) setTrends(trendsData.data);
      if (bottlenecksData.success) setBottlenecks(bottlenecksData.data);
      if (optimizationsData.success) setOptimizations(optimizationsData.data);

    } catch (err) {
      setError('Failed to fetch performance analytics');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-blue-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'border-blue-500';
      case 'medium': return 'border-yellow-500';
      case 'high': return 'border-red-500';
      default: return 'border-gray-500';
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

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const platforms = [...new Set(metrics.map(m => m.platform))];

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Performance Analytics</h2>
          <p className="text-gray-600">Deep insights into scraping performance</p>
        </div>
        <div className="flex space-x-2">
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {platforms.map(platform => (
                <SelectItem key={platform} value={platform}>{platform}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={granularity} onValueChange={setGranularity}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Hour</SelectItem>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchAnalytics} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(metrics.reduce((sum, m) => sum + m.avgDuration, 0) / metrics.length || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length || 0).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(metrics.reduce((sum, m) => sum + m.throughputPerHour, 0) / metrics.length || 0)}/hr
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Efficiency</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(metrics.reduce((sum, m) => sum + m.costEfficiency, 0) / metrics.length || 0)}/$ 
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
          <TabsTrigger value="optimizations">Optimizations</TabsTrigger>
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
                  <BarChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="platform" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="successRate" fill="#10b981" name="Success Rate %" />
                    <Bar dataKey="avgDuration" fill="#3b82f6" name="Avg Duration (ms)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Scatter */}
            <Card>
              <CardHeader>
                <CardTitle>Duration vs Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="avgDuration" name="Duration (ms)" />
                    <YAxis dataKey="successRate" name="Success Rate %" />
                    <Tooltip />
                    <Scatter dataKey="successRate" fill="#8884d8" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Metrics Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Platform</th>
                      <th className="text-left p-2">Total Runs</th>
                      <th className="text-left p-2">Success Rate</th>
                      <th className="text-left p-2">Avg Duration</th>
                      <th className="text-left p-2">P95 Duration</th>
                      <th className="text-left p-2">Throughput</th>
                      <th className="text-left p-2">Cost/Run</th>
                      <th className="text-left p-2">Cost Efficiency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((metric) => (
                      <tr key={metric.platform} className="border-b">
                        <td className="p-2 font-medium">{metric.platform}</td>
                        <td className="p-2">{metric.totalRuns}</td>
                        <td className="p-2">{metric.successRate.toFixed(1)}%</td>
                        <td className="p-2">{formatDuration(metric.avgDuration)}</td>
                        <td className="p-2">{formatDuration(metric.p95Duration)}</td>
                        <td className="p-2">{formatNumber(metric.throughputPerHour)}/hr</td>
                        <td className="p-2">{formatCost(metric.avgCostPerRun)}</td>
                        <td className="p-2">{formatNumber(metric.costEfficiency)}/$ </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Duration Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Duration Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="avgDuration" stroke="#3b82f6" name="Avg Duration (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Success Rate Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Success Rate Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="successRate" stroke="#10b981" name="Success Rate %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Throughput Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Throughput Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="throughput" stroke="#f59e0b" name="Throughput" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Cost per Item Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="costPerItem" stroke="#ef4444" name="Cost per Item ($)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bottlenecks" className="space-y-4">
          {bottlenecks.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p className="text-gray-500">No performance bottlenecks detected</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {bottlenecks.map((bottleneck, index) => (
                <Card key={index} className={`border-l-4 ${getPriorityColor(bottleneck.severity)}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className={`h-5 w-5 mt-0.5 ${getSeverityColor(bottleneck.severity)}`} />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium">{bottleneck.description}</h3>
                            <Badge variant={bottleneck.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {bottleneck.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{bottleneck.impact}</p>
                          <p className="text-sm text-blue-600 mt-2">
                            <strong>Recommendation:</strong> {bottleneck.recommendation}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span>Platform: {bottleneck.platform}</span>
                            <span>Affected runs: {bottleneck.affectedRuns}</span>
                            <span>Cost impact: {formatCost(bottleneck.estimatedCostImpact)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="optimizations" className="space-y-4">
          {optimizations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Target className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p className="text-gray-500">No optimization opportunities found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {optimizations.map((optimization, index) => (
                <Card key={index} className={`border-l-4 ${getPriorityColor(optimization.priority)}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <Target className="h-5 w-5 mt-0.5 text-blue-500" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium">{optimization.platform} - {optimization.optimizationType} optimization</h3>
                            <Badge variant={optimization.priority === 'high' ? 'destructive' : 'secondary'}>
                              {optimization.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{optimization.recommendation}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm">
                            <span>Current: {optimization.currentValue.toFixed(2)}</span>
                            <span>Target: {optimization.targetValue.toFixed(2)}</span>
                            <span className="text-green-600">
                              Potential savings: {formatCost(optimization.potentialSavings)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}