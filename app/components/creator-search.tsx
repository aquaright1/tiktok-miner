'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Filter, X, Loader2, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { useDebounce } from '@/hooks/use-debounce';
import { CreatorCard } from './creator-card';
import { SearchSuggestions } from './search-suggestions';

interface SearchFilters {
  platform?: string;
  category?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
  maxEngagement?: number;
  verified?: boolean;
  tags?: string[];
}

interface SearchResult {
  id: string;
  name: string;
  bio?: string;
  profileImageUrl?: string;
  category?: string;
  tags?: string[];
  isVerified?: boolean;
  metrics?: any;
  platforms?: any;
  external?: boolean;
  source?: string;
}

export function CreatorSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [facets, setFacets] = useState<any>({});
  const [suggestions, setSuggestions] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'followers' | 'engagement'>('relevance');
  const [includeExternal, setIncludeExternal] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Fetch search suggestions
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      fetchSuggestions(debouncedQuery);
    } else {
      setSuggestions({});
      setShowSuggestions(false);
    }
  }, [debouncedQuery]);

  // Perform search when query or filters change
  useEffect(() => {
    performSearch();
  }, [debouncedQuery, filters, sortBy, includeExternal, page]);

  const fetchSuggestions = async (searchQuery: string) => {
    try {
      const response = await fetch(
        `/api/creators/search/suggestions?q=${encodeURIComponent(searchQuery)}`
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.data);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  };

  const performSearch = async () => {
    if (!debouncedQuery && Object.keys(filters).length === 0) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: debouncedQuery,
        sortBy,
        includeExternal: includeExternal.toString(),
        page: page.toString(),
        limit: '20'
      });

      // Add filters to params
      if (filters.platform) params.append('platform', filters.platform);
      if (filters.category) params.append('category', filters.category);
      if (filters.minFollowers) params.append('minFollowers', filters.minFollowers.toString());
      if (filters.maxFollowers) params.append('maxFollowers', filters.maxFollowers.toString());
      if (filters.minEngagement) params.append('minEngagement', filters.minEngagement.toString());
      if (filters.maxEngagement) params.append('maxEngagement', filters.maxEngagement.toString());
      if (filters.verified !== undefined) params.append('verified', filters.verified.toString());
      if (filters.tags?.length) params.append('tags', filters.tags.join(','));

      const response = await fetch(`/api/creators/search/unified?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (page === 1) {
          setResults(data.data.results);
        } else {
          setResults(prev => [...prev, ...data.data.results]);
        }
        setFacets(data.data.facets);
        setHasMore(data.pagination.hasMore);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: any) => {
    if (suggestion.type === 'creator') {
      // Navigate to creator profile
      window.location.href = `/creators/${suggestion.id}`;
    } else if (suggestion.type === 'category') {
      setFilters({ ...filters, category: suggestion.value });
      setQuery('');
    } else if (suggestion.type === 'tag') {
      const newTags = [...(filters.tags || []), suggestion.value];
      setFilters({ ...filters, tags: newTags });
      setQuery('');
    }
    setShowSuggestions(false);
  };

  const handleImportCreator = async (creator: SearchResult) => {
    if (!creator.external || !creator.channelId) return;
    
    try {
      // TODO: Implement creator import
      console.log('Importing creator:', creator);
      alert('Creator import feature coming soon!');
    } catch (error) {
      console.error('Failed to import creator:', error);
    }
  };

  const clearFilters = () => {
    setFilters({});
    setQuery('');
    setPage(1);
  };

  const removeTag = (tag: string) => {
    setFilters({
      ...filters,
      tags: filters.tags?.filter(t => t !== tag)
    });
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search creators by name, bio, or tags..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            onFocus={() => setShowSuggestions(true)}
            className="pl-10 pr-4"
          />
          
          {/* Search Suggestions */}
          {showSuggestions && suggestions && (
            <SearchSuggestions
              suggestions={suggestions}
              onSelect={handleSuggestionClick}
              onClose={() => setShowSuggestions(false)}
            />
          )}
        </div>

        {/* Filters */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Search Filters</SheetTitle>
              <SheetDescription>
                Refine your search with advanced filters
              </SheetDescription>
            </SheetHeader>
            
            <div className="space-y-6 mt-6">
              {/* Platform Filter */}
              <div>
                <label className="text-sm font-medium">Platform</label>
                <Select
                  value={filters.platform || ''}
                  onValueChange={(value) => 
                    setFilters({ ...filters, platform: value || undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All platforms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All platforms</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={filters.category || ''}
                  onValueChange={(value) => 
                    setFilters({ ...filters, category: value || undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All categories</SelectItem>
                    {facets.categories?.map((cat: any) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.value} ({cat.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Followers Range */}
              <div>
                <label className="text-sm font-medium">Followers Range</label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filters.minFollowers || ''}
                      onChange={(e) => 
                        setFilters({ 
                          ...filters, 
                          minFollowers: e.target.value ? parseInt(e.target.value) : undefined 
                        })
                      }
                    />
                    <span>to</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.maxFollowers || ''}
                      onChange={(e) => 
                        setFilters({ 
                          ...filters, 
                          maxFollowers: e.target.value ? parseInt(e.target.value) : undefined 
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Engagement Rate */}
              <div>
                <label className="text-sm font-medium">
                  Engagement Rate: {filters.minEngagement || 0}% - {filters.maxEngagement || 100}%
                </label>
                <Slider
                  min={0}
                  max={20}
                  step={0.5}
                  value={[filters.minEngagement || 0, filters.maxEngagement || 20]}
                  onValueChange={([min, max]) => 
                    setFilters({ ...filters, minEngagement: min, maxEngagement: max })
                  }
                  className="mt-2"
                />
              </div>

              {/* Verified Only */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="verified"
                  checked={filters.verified || false}
                  onCheckedChange={(checked) => 
                    setFilters({ ...filters, verified: checked as boolean })
                  }
                />
                <label
                  htmlFor="verified"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Verified accounts only
                </label>
              </div>

              {/* Include External Results */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="external"
                  checked={includeExternal}
                  onCheckedChange={(checked) => setIncludeExternal(checked as boolean)}
                />
                <label
                  htmlFor="external"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Search external platforms
                </label>
              </div>

              <Button 
                onClick={clearFilters} 
                variant="outline" 
                className="w-full"
              >
                Clear all filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Relevance</SelectItem>
            <SelectItem value="followers">Followers</SelectItem>
            <SelectItem value="engagement">Engagement</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Filters */}
      {(filters.tags?.length || filters.category || filters.platform) && (
        <div className="flex flex-wrap gap-2">
          {filters.platform && (
            <Badge variant="secondary">
              Platform: {filters.platform}
              <X 
                className="ml-1 h-3 w-3 cursor-pointer" 
                onClick={() => setFilters({ ...filters, platform: undefined })}
              />
            </Badge>
          )}
          {filters.category && (
            <Badge variant="secondary">
              Category: {filters.category}
              <X 
                className="ml-1 h-3 w-3 cursor-pointer" 
                onClick={() => setFilters({ ...filters, category: undefined })}
              />
            </Badge>
          )}
          {filters.tags?.map(tag => (
            <Badge key={tag} variant="secondary">
              {tag}
              <X 
                className="ml-1 h-3 w-3 cursor-pointer" 
                onClick={() => removeTag(tag)}
              />
            </Badge>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="space-y-4">
        {loading && page === 1 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {query || Object.keys(filters).length > 0
              ? 'No creators found. Try adjusting your search.'
              : 'Start searching for creators...'}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {results.map((creator) => (
                <div key={creator.id} className="relative">
                  <CreatorCard creator={creator} />
                  {creator.external && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={() => handleImportCreator(creator)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Import
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => setPage(page + 1)}
                  disabled={loading}
                  variant="outline"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}