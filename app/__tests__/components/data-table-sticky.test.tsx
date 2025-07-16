import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataTable } from '@/components/creators/data-table';
import { ColumnDef } from '@tanstack/react-table';

// Mock data for testing
const mockData = Array.from({ length: 50 }, (_, i) => ({
  id: `${i}`,
  username: `user${i}`,
  followerCount: 1000 * (i + 1),
  posts30d: i * 10,
}));

// Mock columns
const mockColumns: ColumnDef<any>[] = [
  {
    accessorKey: 'username',
    header: 'Username',
  },
  {
    accessorKey: 'followerCount',
    header: 'Followers',
  },
  {
    accessorKey: 'posts30d',
    header: 'Posts',
  },
];

describe('DataTable Sticky Header', () => {
  it('should have correct container and table structure', () => {
    const { container } = render(
      <DataTable columns={mockColumns} data={mockData} />
    );

    // Check if the container has the correct class
    const tableContainer = container.querySelector('.data-table-container');
    expect(tableContainer).toBeInTheDocument();
    
    // Check if table has the correct class
    const table = container.querySelector('.data-table');
    expect(table).toBeInTheDocument();
    
    // Check if table header exists
    const tableHeader = container.querySelector('thead');
    expect(tableHeader).toBeInTheDocument();
  });

  it('should render all rows', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);
    
    // Check if all 50 rows are rendered
    const rows = screen.getAllByRole('row');
    // +1 for header row
    expect(rows).toHaveLength(51);
  });

  it('should have correct CSS classes for sticky behavior', () => {
    const { container } = render(
      <DataTable columns={mockColumns} data={mockData} />
    );

    const tableContainer = container.querySelector('.data-table-container');
    expect(tableContainer).toBeInTheDocument();
    
    // Check table structure
    const table = container.querySelector('.data-table');
    expect(table).toBeInTheDocument();
    
    // Check table header exists
    const tableHeader = container.querySelector('.data-table thead');
    expect(tableHeader).toBeInTheDocument();
    
    // Check that th elements exist
    const tableHeads = container.querySelectorAll('th');
    expect(tableHeads.length).toBeGreaterThan(0);
  });
});