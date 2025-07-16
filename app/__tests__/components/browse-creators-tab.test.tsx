import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowseCreatorsTab } from '@/components/creators/browse-creators-tab';

// Mock the fetch function
global.fetch = jest.fn();

describe('BrowseCreatorsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        creators: [
          {
            id: 1,
            username: 'testuser',
            platform: 'tiktok',
            followers: 10000,
            engagementRate: 5.5,
            verified: true,
            avatar: 'https://example.com/avatar.jpg',
            displayName: 'Test User',
            bio: 'Test bio',
            location: 'Test Location',
            videoCount: 25,
            avgLikesPerVideo: 500,
          },
          {
            id: 2,
            username: 'testuser2',
            platform: 'instagram',
            followers: null,
            engagementRate: undefined,
            verified: false,
            avatar: null,
            displayName: null,
            bio: '',
            location: null,
            videoCount: null,
            avgLikesPerVideo: undefined,
          },
        ],
        totalCount: 1,
        totalPages: 1,
        currentPage: 1,
      }),
    });
  });

  it('should render the component', () => {
    render(<BrowseCreatorsTab />);
    
    expect(screen.getByText('Browse Creators')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search creators...')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    render(<BrowseCreatorsTab />);
    
    expect(screen.getByText('Loading creators...')).toBeInTheDocument();
  });

  it('should display creators after loading', async () => {
    render(<BrowseCreatorsTab />);
    
    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
    
    expect(screen.getByText('10K followers')).toBeInTheDocument();
    expect(screen.getByText('5.5% engagement')).toBeInTheDocument();
    expect(screen.getByText('✓ Verified')).toBeInTheDocument();
  });

  it('should handle search input', async () => {
    render(<BrowseCreatorsTab />);
    
    const searchInput = screen.getByPlaceholderText('Search creators...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=test'),
        expect.any(Object)
      );
    });
  });

  it('should handle platform filter', async () => {
    render(<BrowseCreatorsTab />);
    
    const platformFilter = screen.getByRole('combobox', { name: /platform/i });
    fireEvent.change(platformFilter, { target: { value: 'tiktok' } });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('platform=tiktok'),
        expect.any(Object)
      );
    });
  });

  it('should handle pagination', async () => {
    render(<BrowseCreatorsTab />);
    
    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
    
    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object)
      );
    });
  });

  it('should handle API errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));
    
    render(<BrowseCreatorsTab />);
    
    await waitFor(() => {
      expect(screen.getByText('Error loading creators')).toBeInTheDocument();
    });
  });

  it('should handle empty results', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        creators: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1,
      }),
    });
    
    render(<BrowseCreatorsTab />);
    
    await waitFor(() => {
      expect(screen.getByText('No creators found')).toBeInTheDocument();
    });
  });

  it('should handle creators with null/undefined values', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        creators: [
          {
            id: 1,
            username: 'testuser',
            platform: 'tiktok',
            followers: null,
            engagementRate: undefined,
            verified: false,
            avatar: null,
            displayName: null,
            bio: null,
            location: null,
            videoCount: null,
            avgLikesPerVideo: null,
          },
        ],
        totalCount: 1,
        totalPages: 1,
        currentPage: 1,
      }),
    });
    
    render(<BrowseCreatorsTab />);
    
    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
    
    // Should handle null followers gracefully (display 0 or appropriate fallback)
    expect(screen.getByText(/0|—|N\/A/)).toBeInTheDocument();
  });

  it('should handle malformed data gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        creators: [
          {
            id: 1,
            username: 'testuser',
            // Missing required fields should not crash the component
          },
        ],
        totalCount: 1,
        totalPages: 1,
        currentPage: 1,
      }),
    });
    
    render(<BrowseCreatorsTab />);
    
    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });
});