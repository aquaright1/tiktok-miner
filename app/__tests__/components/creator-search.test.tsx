import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatorSearch } from '@/components/creator-search';

describe('CreatorSearch', () => {
  const mockOnSearch = jest.fn();
  const mockOnClear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search form correctly', () => {
    render(<CreatorSearch onSearch={mockOnSearch} onClear={mockOnClear} />);
    
    expect(screen.getByPlaceholderText(/search creators/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('handles search input correctly', async () => {
    const user = userEvent.setup();
    render(<CreatorSearch onSearch={mockOnSearch} onClear={mockOnClear} />);
    
    const searchInput = screen.getByPlaceholderText(/search creators/i);
    await user.type(searchInput, 'test query');
    
    expect(searchInput).toHaveValue('test query');
  });

  it('calls onSearch when form is submitted', async () => {
    const user = userEvent.setup();
    render(<CreatorSearch onSearch={mockOnSearch} onClear={mockOnClear} />);
    
    const searchInput = screen.getByPlaceholderText(/search creators/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    await user.type(searchInput, 'test query');
    await user.click(searchButton);
    
    expect(mockOnSearch).toHaveBeenCalledWith('test query');
  });

  it('calls onClear when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<CreatorSearch onSearch={mockOnSearch} onClear={mockOnClear} />);
    
    const searchInput = screen.getByPlaceholderText(/search creators/i);
    await user.type(searchInput, 'test query');
    
    const clearButton = screen.getByRole('button', { name: /clear/i });
    await user.click(clearButton);
    
    expect(mockOnClear).toHaveBeenCalled();
    expect(searchInput).toHaveValue('');
  });

  it('handles platform filter changes', async () => {
    const user = userEvent.setup();
    render(<CreatorSearch onSearch={mockOnSearch} onClear={mockOnClear} />);
    
    const platformSelect = screen.getByRole('combobox');
    await user.click(platformSelect);
    
    const tiktokOption = screen.getByText('TikTok');
    await user.click(tiktokOption);
    
    expect(platformSelect).toHaveValue('tiktok');
  });

  it('disables search button when input is empty', () => {
    render(<CreatorSearch onSearch={mockOnSearch} onClear={mockOnClear} />);
    
    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeDisabled();
  });

  it('enables search button when input has value', async () => {
    const user = userEvent.setup();
    render(<CreatorSearch onSearch={mockOnSearch} onClear={mockOnClear} />);
    
    const searchInput = screen.getByPlaceholderText(/search creators/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    await user.type(searchInput, 'test');
    
    expect(searchButton).not.toBeDisabled();
  });
});