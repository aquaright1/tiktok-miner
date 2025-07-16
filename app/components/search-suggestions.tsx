'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle } from 'lucide-react';

interface Suggestion {
  type: 'creator' | 'category' | 'tag';
  value: string;
  metadata?: any;
  id?: string;
}

interface SearchSuggestionsProps {
  suggestions: {
    creators?: Suggestion[];
    categories?: Suggestion[];
    tags?: Suggestion[];
  };
  onSelect: (suggestion: Suggestion) => void;
  onClose: () => void;
}

export function SearchSuggestions({ suggestions, onSelect, onClose }: SearchSuggestionsProps) {
  const hasSuggestions = 
    (suggestions.creators?.length || 0) > 0 ||
    (suggestions.categories?.length || 0) > 0 ||
    (suggestions.tags?.length || 0) > 0;

  if (!hasSuggestions) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
      {/* Creators */}
      {suggestions.creators && suggestions.creators.length > 0 && (
        <div>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Creators
          </div>
          {suggestions.creators.map((creator) => (
            <button
              key={creator.id}
              onClick={() => onSelect(creator)}
              className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-3 text-left"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={creator.metadata?.profileImage} />
                <AvatarFallback>
                  {creator.value.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium truncate">
                    {creator.value}
                  </span>
                  {creator.metadata?.verified && (
                    <CheckCircle className="h-3 w-3 text-blue-500" />
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {creator.metadata?.category} • {formatFollowers(creator.metadata?.followers)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Categories */}
      {suggestions.categories && suggestions.categories.length > 0 && (
        <div>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Categories
          </div>
          {suggestions.categories.map((category, index) => (
            <button
              key={index}
              onClick={() => onSelect(category)}
              className="w-full px-3 py-2 hover:bg-gray-50 text-left"
            >
              <span className="text-sm">{category.value}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tags */}
      {suggestions.tags && suggestions.tags.length > 0 && (
        <div>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Tags
          </div>
          <div className="px-3 py-2 flex flex-wrap gap-2">
            {suggestions.tags.map((tag, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="cursor-pointer hover:bg-gray-200"
                onClick={() => onSelect(tag)}
              >
                {tag.value}
                {tag.metadata?.count && (
                  <span className="ml-1 text-xs text-gray-500">
                    ({tag.metadata.count})
                  </span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatFollowers(count?: number): string {
  if (!count) return '0 followers';
  
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M followers`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K followers`;
  }
  
  return `${count} followers`;
}