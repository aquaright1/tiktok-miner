import { render, screen } from '@testing-library/react';
import { CreatorCard } from '@/components/creator-card';

const mockCreator = {
  id: 1,
  username: 'testuser',
  displayName: 'Test User',
  platform: 'tiktok',
  followers: 1000,
  engagementRate: 5.5,
  bio: 'Test bio',
  profilePicture: 'https://example.com/pic.jpg',
  isVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CreatorCard', () => {
  it('renders creator information correctly', () => {
    render(<CreatorCard creator={mockCreator} />);
    
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('1K followers')).toBeInTheDocument();
    expect(screen.getByText('5.5%')).toBeInTheDocument();
    expect(screen.getByText('Test bio')).toBeInTheDocument();
  });

  it('shows verified badge for verified creators', () => {
    render(<CreatorCard creator={mockCreator} />);
    
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('does not show verified badge for unverified creators', () => {
    const unverifiedCreator = { ...mockCreator, isVerified: false };
    render(<CreatorCard creator={unverifiedCreator} />);
    
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });

  it('formats follower count correctly', () => {
    const highFollowerCreator = { ...mockCreator, followers: 1500000 };
    render(<CreatorCard creator={highFollowerCreator} />);
    
    expect(screen.getByText('1.5M followers')).toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    const minimalCreator = {
      id: 2,
      username: 'minimal',
      platform: 'instagram',
      followers: 500,
      engagementRate: 3.2,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    render(<CreatorCard creator={minimalCreator} />);
    
    expect(screen.getByText('minimal')).toBeInTheDocument();
    expect(screen.getByText('500 followers')).toBeInTheDocument();
    expect(screen.getByText('3.2%')).toBeInTheDocument();
  });
});