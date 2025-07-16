import { GET } from '@/app/api/health/route';
import { NextRequest } from 'next/server';

describe('/api/health', () => {
  it('should return health status', async () => {
    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('healthy');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('version');
  });
});