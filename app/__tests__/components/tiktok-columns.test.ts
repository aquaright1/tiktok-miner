import { tiktokColumns } from '@/components/creators/tiktok-columns';

describe('TikTok Columns', () => {
  test('should have correct column order', () => {
    const expectedOrder = [
      'profileUrl',      // Profile
      'engagementRate',  // Gem Score
      'followerCount',   // Followers
      'posts30d',        // Posts
      'likesTotal',      // Likes
      'commentsTotal',   // Comments
      'viewsTotal',      // Views
      'sharesTotal',     // Shares
      'category',        // Category
      'lastSync'         // Last Updated
    ];
    
    const actualOrder = tiktokColumns.map(col => col.accessorKey);
    
    console.log('Expected order:', expectedOrder);
    console.log('Actual order:', actualOrder);
    
    expect(actualOrder).toEqual(expectedOrder);
  });
  
  test('should have correct headers', () => {
    const profileColumn = tiktokColumns.find(col => col.accessorKey === 'profileUrl');
    const gemScoreColumn = tiktokColumns.find(col => col.accessorKey === 'engagementRate');
    const followersColumn = tiktokColumns.find(col => col.accessorKey === 'followerCount');
    
    expect(profileColumn?.header).toBe('Profile');
    expect(gemScoreColumn?.header).toBeDefined(); // Should have sortable header
    expect(followersColumn?.header).toBeDefined(); // Should have sortable header
  });
  
  test('should have gem score as second column', () => {
    const secondColumn = tiktokColumns[1];
    expect(secondColumn.accessorKey).toBe('engagementRate');
  });
  
  test('should have followers as third column', () => {
    const thirdColumn = tiktokColumns[2];
    expect(thirdColumn.accessorKey).toBe('followerCount');
  });
});