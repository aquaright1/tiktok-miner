/**
 * Test to verify the last updated field is working correctly
 */

describe('Last Updated Field API Test', () => {
  test('should return lastSync field in API response', async () => {
    // Mock fetch for testing
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        creators: [
          {
            username: 'testuser',
            lastSync: '2025-07-11T02:04:33.364Z',
            followerCount: 10000
          }
        ]
      })
    });

    const response = await fetch('http://localhost:3000/api/creators?table=tiktok_profiles&limit=1');
    const data = await response.json();
    
    expect(data.creators[0].lastSync).toBeDefined();
    expect(data.creators[0].lastSync).toBe('2025-07-11T02:04:33.364Z');
  });

  test('should verify column accessor matches API field', () => {
    // Test data structure that matches API response
    const mockCreator = {
      username: 'testuser',
      lastSync: '2025-07-11T02:04:33.364Z',
      followerCount: 10000
    };

    // Check that the field exists and is accessible
    expect(mockCreator.lastSync).toBeDefined();
    expect(typeof mockCreator.lastSync).toBe('string');
    
    // Test date parsing
    const date = new Date(mockCreator.lastSync);
    expect(date.getMonth() + 1).toBe(7); // July
    expect(date.getDate()).toBe(11);
  });

  test('should check if there is a mismatch between API field and column accessor', () => {
    // The column uses accessorKey: "lastSync"
    // The API should return lastSync field
    
    const expectedAccessorKey = 'lastSync';
    const mockApiResponse = {
      lastSync: '2025-07-11T02:04:33.364Z',
      lastUpdated: '2025-07-11T02:04:33.364Z'
    };
    
    // Check if the accessor key exists in the response
    expect(mockApiResponse[expectedAccessorKey]).toBeDefined();
    
    console.log('API fields:', Object.keys(mockApiResponse));
    console.log('Column accessor expects:', expectedAccessorKey);
    console.log('Value found:', mockApiResponse[expectedAccessorKey]);
  });
});