'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Users, 
  TrendingUp, 
  Eye, 
  Heart,
  MessageCircle,
  Share,
  Star,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react';
import ErrorTracking from './error-tracking';

interface CreatorData {
  id: string;
  name: string;
  platform: string;
  followers: number;
  engagementRate: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  category: string;
  lastUpdated: string;
  profileUrl: string;
}

interface CreatorAnalysisDashboardProps {
  className?: string;
}

export default function CreatorAnalysisDashboard({ className }: CreatorAnalysisDashboardProps) {
  const [creators, setCreators] = useState<CreatorData[]>([]);
  const [filteredCreators, setFilteredCreators] = useState<CreatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('followers');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchCreators();
  }, []);

  useEffect(() => {
    filterAndSortCreators();
  }, [creators, searchTerm, selectedPlatform, selectedCategory, sortBy, sortOrder]);

  const fetchCreators = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // This would fetch from your creators API
      const response = await fetch('/api/creators');
      const data = await response.json();
      
      if (data.success) {
        setCreators(data.creators || []);
      } else {
        setError(data.error || 'Failed to fetch creators');
      }
    } catch (err) {
      setError('Failed to fetch creators');
      console.error('Error fetching creators:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCreators = () => {
    let filtered = [...creators];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(creator => 
        creator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        creator.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply platform filter
    if (selectedPlatform !== 'all') {
      filtered = filtered.filter(creator => creator.platform === selectedPlatform);
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(creator => creator.category === selectedCategory);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortBy as keyof CreatorData];
      const bValue = b[sortBy as keyof CreatorData];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortOrder === 'desc' 
        ? bStr.localeCompare(aStr) 
        : aStr.localeCompare(bStr);
    });

    setFilteredCreators(filtered);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatPercent = (num: number) => {
    return (num * 100).toFixed(1) + '%';
  };

  const getEngagementColor = (rate: number) => {
    if (rate >= 0.05) return 'text-green-600';
    if (rate >= 0.02) return 'text-yellow-600';
    return 'text-red-600';
  };


  const platforms = [...new Set(creators.map(c => c.platform))];
  const categories = [...new Set(creators.map(c => c.category))];

  // Analytics data
  const platformData = platforms.map(platform => ({
    platform,
    count: creators.filter(c => c.platform === platform).length,
    avgFollowers: creators.filter(c => c.platform === platform)
      .reduce((sum, c) => sum + c.followers, 0) / creators.filter(c => c.platform === platform).length || 0,
    avgEngagement: creators.filter(c => c.platform === platform)
      .reduce((sum, c) => sum + c.engagementRate, 0) / creators.filter(c => c.platform === platform).length || 0,
  }));

  const categoryData = categories.map(category => ({
    category,
    count: creators.filter(c => c.category === category).length,
    avgGemScore: creators.filter(c => c.category === category)
      .reduce((sum, c) => sum + c.engagementRate, 0) / creators.filter(c => c.category === category).length || 0,
  }));

  const topCreators = [...creators]
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 10);

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
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Creator Analysis Dashboard</h1>
          <p className="text-gray-600">Analyze and compare creator performance</p>
        </div>
        <Button onClick={fetchCreators} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Creators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creators.length}</div>
            <p className="text-xs text-muted-foreground">
              Across {platforms.length} platforms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Followers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(creators.reduce((sum, c) => sum + c.followers, 0) / creators.length || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatNumber(creators.reduce((sum, c) => sum + c.followers, 0))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(creators.reduce((sum, c) => sum + c.engagementRate, 0) / creators.length || 0)}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Main Content */}
      <Tabs defaultValue="creators" className="space-y-4">
        <TabsList>
          <TabsTrigger value="creators">Creators</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="top-performers">Top Performers</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="creators" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <Input
                placeholder="Search creators..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {platforms.map(platform => (
                  <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="followers">Followers</SelectItem>
                <SelectItem value="engagementRate">Engagement</SelectItem>
                <SelectItem value="avgViews">Avg Views</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results */}
          <div className="text-sm text-gray-600 mb-4">
            Showing {filteredCreators.length} of {creators.length} creators
          </div>

          {/* Creators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCreators.map((creator) => (
              <Card key={creator.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{creator.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">{creator.platform}</Badge>
                        <Badge variant="outline">{creator.category}</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Followers:</span>
                      <span className="text-sm font-medium">{formatNumber(creator.followers)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Engagement:</span>
                      <span className={`text-sm font-medium ${getEngagementColor(creator.engagementRate)}`}>
                        {formatPercent(creator.engagementRate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg Views:</span>
                      <span className="text-sm font-medium">{formatNumber(creator.avgViews)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg Likes:</span>
                      <span className="text-sm font-medium">{formatNumber(creator.avgLikes)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Platform Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={platformData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ platform, count }) => `${platform}: ${count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {platformData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Platform Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={platformData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="platform" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgEngagement" fill="#10b981" name="Avg Engagement" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgGemScore" fill="#3b82f6" name="Avg Gem Score" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="top-performers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Performers by Gem Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topCreators.map((creator, index) => (
                  <div key={creator.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                      </div>
                      <div>
                        <div className="font-semibold">{creator.name}</div>
                        <div className="text-sm text-gray-600">{creator.platform} • {creator.category}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-semibold">{formatNumber(creator.followers)}</div>
                        <div className="text-sm text-gray-600">followers</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${getEngagementColor(creator.engagementRate)}`}>
                          {formatPercent(creator.engagementRate)}
                        </div>
                        <div className="text-sm text-gray-600">engagement</div>
                      </div>
                      <div className="text-right">
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <ErrorTracking />
        </TabsContent>
      </Tabs>
    </div>
  );
}