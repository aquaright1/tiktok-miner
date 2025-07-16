import { tiktokColumns } from '@/components/creators/tiktok-columns';

describe('Last Updated Column', () => {
  test('should find last updated column', () => {
    const lastUpdatedColumn = tiktokColumns.find(col => col.accessorKey === 'lastSync');
    expect(lastUpdatedColumn).toBeDefined();
    expect(lastUpdatedColumn?.accessorKey).toBe('lastSync');
  });

  test('should render date correctly', () => {
    const lastUpdatedColumn = tiktokColumns.find(col => col.accessorKey === 'lastSync');
    
    if (!lastUpdatedColumn || typeof lastUpdatedColumn.cell !== 'function') {
      fail('Last updated column or cell function not found');
      return;
    }

    // Mock row data with lastSync
    const mockRow = {
      getValue: (key: string) => {
        if (key === 'lastSync') {
          return '2025-07-11T19:20:34.000Z'; // Mock date
        }
        return null;
      },
      original: {}
    };

    // @ts-ignore - Mock the cell context
    const result = lastUpdatedColumn.cell({ row: mockRow });
    
    console.log('Cell render result:', result);
    expect(result).toBeDefined();
  });

  test('should handle null/undefined lastSync', () => {
    const lastUpdatedColumn = tiktokColumns.find(col => col.accessorKey === 'lastSync');
    
    if (!lastUpdatedColumn || typeof lastUpdatedColumn.cell !== 'function') {
      fail('Last updated column or cell function not found');
      return;
    }

    // Mock row data with null lastSync
    const mockRow = {
      getValue: (key: string) => {
        if (key === 'lastSync') {
          return null;
        }
        return null;
      },
      original: {}
    };

    // @ts-ignore - Mock the cell context
    const result = lastUpdatedColumn.cell({ row: mockRow });
    
    console.log('Null cell render result:', result);
    expect(result).toBeDefined();
  });

  test('should check API data structure', async () => {
    // Test the actual API to see what data structure is returned
    try {
      const response = await fetch('http://localhost:3000/api/creators?table=tiktok_profiles&limit=3');
      const data = await response.json();
      
      console.log('API Response structure:');
      if (data.creators && data.creators.length > 0) {
        const firstCreator = data.creators[0];
        console.log('First creator keys:', Object.keys(firstCreator));
        console.log('lastSync value:', firstCreator.lastSync);
        console.log('lastUpdated value:', firstCreator.lastUpdated);
        console.log('lastUpdate value:', firstCreator.lastUpdate);
        console.log('last_updated value:', firstCreator.last_updated);
        
        // Check if any date-related fields exist
        const dateFields = Object.keys(firstCreator).filter(key => 
          key.toLowerCase().includes('last') || 
          key.toLowerCase().includes('updated') || 
          key.toLowerCase().includes('sync')
        );
        console.log('Date-related fields:', dateFields);
      }
    } catch (error) {
      console.log('API test failed:', error.message);
    }
  });
});