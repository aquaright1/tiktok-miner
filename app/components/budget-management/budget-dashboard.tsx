'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Target,
  Zap
} from 'lucide-react';

interface Budget {
  id: string;
  name: string;
  description?: string;
  budgetType: string;
  totalAmount: number;
  spentAmount: number;
  remainingAmount: number;
  status: string;
  startDate: string;
  endDate: string;
  budgetAllocations?: BudgetAllocation[];
  _count?: {
    costAllocations: number;
  };
}

interface BudgetAllocation {
  id: string;
  platform: string;
  serviceType: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  priority: string;
}

interface BudgetSummary {
  budget: Budget;
  allocations: BudgetAllocation[];
  totalSpent: number;
  totalRemaining: number;
  spentPercentage: number;
  alerts: any[];
  projectedEndDate?: string;
  burnRate: number;
}

interface BudgetAnalytics {
  totalBudgets: number;
  activeBudgets: number;
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  averageSpentPercentage: number;
  budgetsExceeded: number;
  budgetsNearLimit: number;
  topSpendingPlatforms: Array<{
    platform: string;
    totalSpent: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    totalSpent: number;
    budgetUtilization: number;
  }>;
}

interface OptimizationReport {
  totalPotentialSavings: number;
  totalCurrentCost: number;
  savingsPercentage: number;
  recommendations: Array<{
    id: string;
    platform: string;
    serviceType: string;
    potentialSavings: number;
    recommendation: string;
    priority: number;
  }>;
  quickWins: Array<{
    platform: string;
    potentialSavings: number;
    recommendation: string;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const BudgetDashboard: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<BudgetSummary | null>(null);
  const [analytics, setAnalytics] = useState<BudgetAnalytics | null>(null);
  const [optimizationReport, setOptimizationReport] = useState<OptimizationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBudgets();
    fetchAnalytics();
    fetchOptimizationReport();
  }, []);

  const fetchBudgets = async () => {
    try {
      const response = await fetch('/api/budget');
      const data = await response.json();
      
      if (data.success) {
        setBudgets(data.data);
        if (data.data.length > 0) {
          fetchBudgetDetails(data.data[0].id);
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch budgets');
    }
  };

  const fetchBudgetDetails = async (budgetId: string) => {
    try {
      const response = await fetch(`/api/budget/${budgetId}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedBudget(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch budget details:', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/budget/analytics');
      const data = await response.json();
      
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  };

  const fetchOptimizationReport = async () => {
    try {
      const response = await fetch('/api/cost-optimization?generate=true');
      const data = await response.json();
      
      if (data.success) {
        setOptimizationReport(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch optimization report:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'exceeded': return 'bg-red-500';
      case 'expired': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const getSpentPercentage = (budget: Budget) => {
    return budget.totalAmount > 0 ? (budget.spentAmount / budget.totalAmount) * 100 : 0;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Budget Management Dashboard</h1>
        <Button onClick={() => window.location.reload()}>
          Refresh Data
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budgets</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalBudgets || 0}</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.activeBudgets || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Allocated</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics?.totalAllocated || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(analytics?.totalSpent || 0)} spent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.averageSpentPercentage?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics?.budgetsNearLimit || 0} near limit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(optimizationReport?.totalPotentialSavings || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {optimizationReport?.savingsPercentage?.toFixed(1) || 0}% potential savings
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="budgets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget List */}
            <Card>
              <CardHeader>
                <CardTitle>Active Budgets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {budgets.map((budget) => (
                    <div 
                      key={budget.id} 
                      className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => fetchBudgetDetails(budget.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">{budget.name}</h4>
                          <p className="text-sm text-gray-600">{budget.budgetType}</p>
                        </div>
                        <Badge className={getStatusColor(budget.status)}>
                          {budget.status}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Spent</span>
                          <span>{formatCurrency(budget.spentAmount)}</span>
                        </div>
                        <Progress value={getSpentPercentage(budget)} className="h-2" />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{formatDate(budget.startDate)}</span>
                          <span>{formatDate(budget.endDate)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Budget Details */}
            {selectedBudget && (
              <Card>
                <CardHeader>
                  <CardTitle>Budget Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-lg">{selectedBudget.budget.name}</h4>
                      <p className="text-gray-600">{selectedBudget.budget.description}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Total Budget</p>
                        <p className="text-xl font-bold">{formatCurrency(selectedBudget.budget.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Spent</p>
                        <p className="text-xl font-bold">{formatCurrency(selectedBudget.totalSpent)}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Budget Usage</span>
                        <span>{selectedBudget.spentPercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={selectedBudget.spentPercentage} className="h-3" />
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Daily Burn Rate</p>
                      <p className="text-lg font-medium">{formatCurrency(selectedBudget.burnRate)}</p>
                    </div>

                    {selectedBudget.projectedEndDate && (
                      <div>
                        <p className="text-sm text-gray-500">Projected End Date</p>
                        <p className="text-lg font-medium">
                          {formatDate(selectedBudget.projectedEndDate)}
                        </p>
                      </div>
                    )}

                    {selectedBudget.alerts.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">Active Alerts</p>
                        <div className="space-y-2">
                          {selectedBudget.alerts.map((alert, index) => (
                            <Alert key={index} className="p-2">
                              <AlertTriangle className="h-3 w-3" />
                              <AlertDescription className="text-xs">
                                {alert.message}
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Platform Spending */}
            <Card>
              <CardHeader>
                <CardTitle>Top Spending Platforms</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics?.topSpendingPlatforms || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({name, percentage}) => `${name} ${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="totalSpent"
                    >
                      {analytics?.topSpendingPlatforms.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Spending Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics?.monthlyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Line type="monotone" dataKey="totalSpent" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Wins */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Wins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {optimizationReport?.quickWins.map((win, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{win.platform}</h4>
                        <Badge variant="outline">
                          {formatCurrency(win.potentialSavings)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{win.recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* All Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle>All Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {optimizationReport?.recommendations.map((rec) => (
                    <div key={rec.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">{rec.platform}</h4>
                          <p className="text-sm text-gray-500">{rec.serviceType}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">
                            {formatCurrency(rec.potentialSavings)}
                          </Badge>
                          <p className="text-xs text-gray-500">Priority: {rec.priority}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{rec.recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BudgetDashboard;