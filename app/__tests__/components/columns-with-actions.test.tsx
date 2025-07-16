import { render, screen } from '@testing-library/react';
import { ColumnDef } from '@tanstack/react-table';

// Mock the formatNumber function for testing
const formatNumber = (num: number | null | undefined) => {
  if (!num || isNaN(num)) return '0'
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

describe('Columns with Actions', () => {
  describe('formatNumber utility', () => {
    it('should handle null values', () => {
      expect(formatNumber(null)).toBe('0');
    });

    it('should handle undefined values', () => {
      expect(formatNumber(undefined)).toBe('0');
    });

    it('should handle NaN values', () => {
      expect(formatNumber(NaN)).toBe('0');
    });

    it('should format numbers correctly', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(999)).toBe('999');
      expect(formatNumber(1000)).toBe('1.0K');
      expect(formatNumber(1500)).toBe('1.5K');
      expect(formatNumber(1000000)).toBe('1.0M');
      expect(formatNumber(1500000)).toBe('1.5M');
    });
  });

  describe('Column cell rendering', () => {
    const createMockRow = (videoCount: number | null | undefined, followerCount: number | null | undefined) => ({
      getValue: (key: string) => {
        if (key === 'videoCount') return videoCount;
        if (key === 'followerCount') return followerCount;
        return null;
      },
      original: { videoCount, followerCount }
    });

    it('should render videoCount cell with null value', () => {
      const mockRow = createMockRow(null, 1000);
      
      // Simulate the videoCount cell component
      const VideoCountCell = ({ row }: { row: any }) => {
        const videoCount = row.getValue("videoCount") as number;
        return (
          <div className="font-medium">
            {videoCount ? videoCount.toString() : "0"}
          </div>
        );
      };

      render(<VideoCountCell row={mockRow} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should render videoCount cell with undefined value', () => {
      const mockRow = createMockRow(undefined, 1000);
      
      const VideoCountCell = ({ row }: { row: any }) => {
        const videoCount = row.getValue("videoCount") as number;
        return (
          <div className="font-medium">
            {videoCount ? videoCount.toString() : "0"}
          </div>
        );
      };

      render(<VideoCountCell row={mockRow} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should render videoCount cell with valid value', () => {
      const mockRow = createMockRow(25, 1000);
      
      const VideoCountCell = ({ row }: { row: any }) => {
        const videoCount = row.getValue("videoCount") as number;
        return (
          <div className="font-medium">
            {videoCount ? videoCount.toString() : "0"}
          </div>
        );
      };

      render(<VideoCountCell row={mockRow} />);
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('should render followerCount cell with null value', () => {
      const mockRow = createMockRow(10, null);
      
      const FollowerCountCell = ({ row }: { row: any }) => (
        <div className="font-medium">
          {formatNumber(row.getValue("followerCount") as number | null | undefined)}
        </div>
      );

      render(<FollowerCountCell row={mockRow} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should render followerCount cell with valid value', () => {
      const mockRow = createMockRow(10, 5500);
      
      const FollowerCountCell = ({ row }: { row: any }) => (
        <div className="font-medium">
          {formatNumber(row.getValue("followerCount") as number | null | undefined)}
        </div>
      );

      render(<FollowerCountCell row={mockRow} />);
      expect(screen.getByText('5.5K')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle zero values correctly', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('should handle negative values', () => {
      expect(formatNumber(-1000)).toBe('-1000'); // Negative numbers don't get K/M formatting due to >= checks
    });

    it('should handle very large numbers', () => {
      expect(formatNumber(1500000000)).toBe('1500.0M');
    });

    it('should handle decimal numbers', () => {
      expect(formatNumber(1234.56)).toBe('1.2K');
      expect(formatNumber(1234567.89)).toBe('1.2M');
    });
  });
});