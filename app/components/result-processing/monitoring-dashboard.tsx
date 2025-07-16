/**
 * React component for result processing monitoring dashboard
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Database,
  Zap,
  AlertCircle
} from 'lucide-react';

interface MonitoringData {
  stats: {
    totalBatches: number;
    totalAlerts: number;
    activeAlerts: number;
    averageHealthScore: number;
    memoryUsage: number;
  };
  insights: {
    trends: {
      throughputTrend: number;
      errorTrend: number;
      latencyTrend: number;
      memoryTrend: number;
    };
    recommendations: Array<{
      type: string;
      priority: string;
      description: string;
      expectedImprovement: string;
      actionRequired: string;
    }>;
    healthScore: number;
    predictedCapacity: {
      currentCapacity: number;
      maxCapacity: number;
      bottleneck: string;
      timeToCapacity: number;
      scaleRecommendation: string;
    };
  };
  timestamp: string;
}

interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export default function MonitoringDashboard() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMonitoringData();
    fetchAlerts();
    
    // Set up polling
    const interval = setInterval(() => {
      fetchMonitoringData();
      fetchAlerts();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchMonitoringData = async () => {
    try {
      const response = await fetch('/api/result-processing/monitoring');
      if (!response.ok) throw new Error('Failed to fetch monitoring data');
      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/result-processing/monitoring/alerts?limit=10');
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const result = await response.json();
      setAlerts(result.data.alerts);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/result-processing/monitoring/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'resolve' }),
      });
      if (!response.ok) throw new Error('Failed to resolve alert');
      await fetchAlerts(); // Refresh alerts
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  const formatTrend = (trend: number) => {
    const icon = trend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
    const color = trend > 0 ? 'text-green-600' : 'text-red-600';
    return (
      <span className={`flex items-center gap-1 ${color}`}>
        {icon}
        {Math.abs(trend).toFixed(1)}%
      </span>
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'error': return 'bg-red-50 text-red-700 border-red-200';
      case 'warning': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'info': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'info': return <CheckCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading monitoring data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>Error loading monitoring data: {error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>No monitoring data available</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Result Processing Monitoring</h1>
        <Badge variant="outline">
          Last updated: {new Date(data.timestamp).toLocaleTimeString()}
        </Badge>
      </div>

      {/* Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={data.insights.healthScore * 100} className="flex-1" />
            <span className="text-2xl font-bold">
              {(data.insights.healthScore * 100).toFixed(1)}%
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {data.insights.healthScore >= 0.8 ? 'Excellent' : 
             data.insights.healthScore >= 0.6 ? 'Good' : 
             data.insights.healthScore >= 0.4 ? 'Fair' : 'Poor'}
          </p>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Batches</p>
                <p className="text-2xl font-bold">{data.stats.totalBatches}</p>
              </div>
              <Database className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Alerts</p>
                <p className="text-2xl font-bold">{data.stats.activeAlerts}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Memory Usage</p>
                <p className="text-2xl font-bold">
                  {(data.stats.memoryUsage / 1024 / 1024).toFixed(1)}MB
                </p>
              </div>
              <Zap className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Capacity</p>
                <p className="text-2xl font-bold">
                  {((data.insights.predictedCapacity.currentCapacity / data.insights.predictedCapacity.maxCapacity) * 100).toFixed(1)}%
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="trends">Performance Trends</TabsTrigger>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span>Throughput Trend</span>
                  {formatTrend(data.insights.trends.throughputTrend)}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span>Error Rate Trend</span>
                  {formatTrend(data.insights.trends.errorTrend)}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span>Latency Trend</span>
                  {formatTrend(data.insights.trends.latencyTrend)}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span>Memory Trend</span>
                  {formatTrend(data.insights.trends.memoryTrend)}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No active alerts</p>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className={`flex items-center justify-between p-3 rounded border ${getSeverityColor(alert.severity)}`}>
                      <div className="flex items-center gap-3">
                        {getSeverityIcon(alert.severity)}
                        <div>
                          <p className="font-medium">{alert.message}</p>
                          <p className="text-sm opacity-75">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {!alert.resolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveAlert(alert.id)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {data.insights.recommendations.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No recommendations at this time</p>
              ) : (
                <div className="space-y-4">
                  {data.insights.recommendations.map((rec, index) => (
                    <div key={index} className="p-4 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{rec.description}</h3>
                        <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Expected improvement: {rec.expectedImprovement}
                      </p>
                      <p className="text-sm">
                        <strong>Action:</strong> {rec.actionRequired}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}