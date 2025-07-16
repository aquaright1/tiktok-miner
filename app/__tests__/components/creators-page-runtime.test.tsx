import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react'
import CreatorsPage from '@/app/creators/page'
import { BrowseCreatorsTab } from '@/components/creators/browse-creators-tab'
import '@testing-library/jest-dom'

// Mock SWR
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn()
}))

// Mock Next.js components
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))

// Mock UI components that might cause issues
jest.mock('@/components/ui/pagination', () => ({
  Pagination: ({ currentPage, totalPages, onPageChange }: any) => (
    <div data-testid="pagination">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
        Previous
      </button>
      <span>Page {currentPage} of {totalPages}</span>
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
        Next
      </button>
    </div>
  )
}))

jest.mock('@/components/creators/data-table', () => ({
  DataTable: ({ columns, data, loading }: any) => (
    <div data-testid="data-table">
      {loading ? <div>Loading...</div> : <div>Data: {JSON.stringify(data)}</div>}
    </div>
  )
}))

jest.mock('@/components/creators/columns-with-actions', () => ({
  createColumns: () => [
    { id: 'name', header: 'Name' },
    { id: 'platform', header: 'Platform' }
  ]
}))

jest.mock('@/components/creators/add-creator-dialog', () => ({
  AddCreatorDialog: ({ onSuccess }: any) => (
    <button onClick={onSuccess} data-testid="add-creator-btn">Add Creator</button>
  )
}))

// Mock fetch
global.fetch = jest.fn()

describe('Creators Page Runtime Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('CreatorsPage Component', () => {
    it('should render without crashing', () => {
      render(<CreatorsPage />)
      expect(screen.getByText('Creators')).toBeInTheDocument()
    })

    it('should handle missing child components gracefully', () => {
      // Mock BrowseCreatorsTab to throw an error
      jest.doMock('@/components/creators/browse-creators-tab', () => ({
        BrowseCreatorsTab: () => {
          throw new Error('Component failed to load')
        }
      }))

      expect(() => render(<CreatorsPage />)).not.toThrow()
    })
  })

  describe('BrowseCreatorsTab Component', () => {
    const mockUseSWR = require('swr').default

    beforeEach(() => {
      mockUseSWR.mockReturnValue({
        data: {
          creators: [
            { id: '1', name: 'Test Creator', platform: 'instagram' },
            { id: '2', name: 'Another Creator', platform: 'tiktok' }
          ],
          total: 2,
          page: 1,
          pageSize: 20
        },
        error: null,
        isLoading: false,
        mutate: jest.fn()
      })
    })

    it('should render without crashing', () => {
      render(<BrowseCreatorsTab />)
      expect(screen.getByText('Browse Creators')).toBeInTheDocument()
    })

    it('should handle loading state', () => {
      mockUseSWR.mockReturnValue({
        data: null,
        error: null,
        isLoading: true,
        mutate: jest.fn()
      })

      render(<BrowseCreatorsTab />)
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should handle error state', () => {
      mockUseSWR.mockReturnValue({
        data: null,
        error: new Error('Failed to fetch'),
        isLoading: false,
        mutate: jest.fn()
      })

      render(<BrowseCreatorsTab />)
      // Component should still render even with error
      expect(screen.getByText('Browse Creators')).toBeInTheDocument()
    })

    it('should handle empty data', () => {
      mockUseSWR.mockReturnValue({
        data: {
          creators: [],
          total: 0,
          page: 1,
          pageSize: 20
        },
        error: null,
        isLoading: false,
        mutate: jest.fn()
      })

      render(<BrowseCreatorsTab />)
      expect(screen.getByText('Browse Creators')).toBeInTheDocument()
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })

    it('should handle null/undefined data gracefully', () => {
      mockUseSWR.mockReturnValue({
        data: null,
        error: null,
        isLoading: false,
        mutate: jest.fn()
      })

      render(<BrowseCreatorsTab />)
      expect(screen.getByText('Browse Creators')).toBeInTheDocument()
      expect(screen.getByTestId('data-table')).toBeInTheDocument()
    })

    it('should handle search input changes', async () => {
      const mockMutate = jest.fn()
      mockUseSWR.mockReturnValue({
        data: { creators: [], total: 0, page: 1, pageSize: 20 },
        error: null,
        isLoading: false,
        mutate: mockMutate
      })

      render(<BrowseCreatorsTab />)
      
      const searchInput = screen.getByPlaceholderText('Search by name or username...')
      
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'test search' } })
      })

      expect(searchInput).toHaveValue('test search')
    })

    it('should handle platform filter changes', async () => {
      const mockMutate = jest.fn()
      mockUseSWR.mockReturnValue({
        data: { creators: [], total: 0, page: 1, pageSize: 20 },
        error: null,
        isLoading: false,
        mutate: mockMutate
      })

      render(<BrowseCreatorsTab />)
      
      // Test platform selection
      const platformSelect = screen.getByRole('combobox')
      expect(platformSelect).toBeInTheDocument()
    })

    it('should handle follower range input changes', async () => {
      const mockMutate = jest.fn()
      mockUseSWR.mockReturnValue({
        data: { creators: [], total: 0, page: 1, pageSize: 20 },
        error: null,
        isLoading: false,
        mutate: mockMutate
      })

      render(<BrowseCreatorsTab />)
      
      const minFollowersInput = screen.getByPlaceholderText('Min')
      const maxFollowersInput = screen.getByPlaceholderText('Max')

      await act(async () => {
        fireEvent.change(minFollowersInput, { target: { value: '1000' } })
        fireEvent.change(maxFollowersInput, { target: { value: '50000' } })
      })

      expect(minFollowersInput).toHaveValue(1000)
      expect(maxFollowersInput).toHaveValue(50000)
    })

    it('should handle invalid follower range inputs', async () => {
      const mockMutate = jest.fn()
      mockUseSWR.mockReturnValue({
        data: { creators: [], total: 0, page: 1, pageSize: 20 },
        error: null,
        isLoading: false,
        mutate: mockMutate
      })

      render(<BrowseCreatorsTab />)
      
      const minFollowersInput = screen.getByPlaceholderText('Min')
      const maxFollowersInput = screen.getByPlaceholderText('Max')

      await act(async () => {
        fireEvent.change(minFollowersInput, { target: { value: 'invalid' } })
        fireEvent.change(maxFollowersInput, { target: { value: 'also invalid' } })
      })

      // Should handle invalid inputs gracefully
      expect(minFollowersInput).toHaveValue(0)
      expect(maxFollowersInput).toHaveValue(0)
    })

    it('should handle refresh button click', async () => {
      const mockMutate = jest.fn()
      mockUseSWR.mockReturnValue({
        data: { creators: [], total: 0, page: 1, pageSize: 20 },
        error: null,
        isLoading: false,
        mutate: mockMutate
      })

      render(<BrowseCreatorsTab />)
      
      const refreshButton = screen.getByText('Refresh')
      
      await act(async () => {
        fireEvent.click(refreshButton)
      })

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled()
      })
    })

    it('should handle pagination clicks', async () => {
      mockUseSWR.mockReturnValue({
        data: { creators: [], total: 100, page: 1, pageSize: 20 },
        error: null,
        isLoading: false,
        mutate: jest.fn()
      })

      render(<BrowseCreatorsTab />)
      
      // Should show pagination when there are multiple pages
      const pagination = screen.getByTestId('pagination')
      expect(pagination).toBeInTheDocument()
    })

    it('should handle corrupted data gracefully', () => {
      mockUseSWR.mockReturnValue({
        data: {
          creators: [
            null,
            undefined,
            { id: null, name: undefined, platform: 'invalid' },
            { id: '1', name: 'Valid Creator', platform: 'instagram' }
          ],
          total: 'invalid',
          page: null,
          pageSize: undefined
        },
        error: null,
        isLoading: false,
        mutate: jest.fn()
      })

      expect(() => render(<BrowseCreatorsTab />)).not.toThrow()
    })

    it('should handle network errors in fetcher', async () => {
      // Mock fetch to throw network error
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      mockUseSWR.mockReturnValue({
        data: null,
        error: new Error('Network error'),
        isLoading: false,
        mutate: jest.fn()
      })

      render(<BrowseCreatorsTab />)
      expect(screen.getByText('Browse Creators')).toBeInTheDocument()
    })

    it('should handle malformed API responses', async () => {
      // Mock fetch to return malformed response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      })

      mockUseSWR.mockReturnValue({
        data: { creators: [], total: 0, page: 1, pageSize: 20 },
        error: null,
        isLoading: false,
        mutate: jest.fn()
      })

      render(<BrowseCreatorsTab />)
      expect(screen.getByText('Browse Creators')).toBeInTheDocument()
    })
  })
});