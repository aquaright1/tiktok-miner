import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('App Health Integration Tests', () => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
  
  describe('Core functionality', () => {
    it('should serve the application homepage', async () => {
      const response = await fetch(`${baseUrl}/`);
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html).toContain('tiktok-miner');
    });

    it('should serve the creators dashboard', async () => {
      const response = await fetch(`${baseUrl}/creators`);
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html).toContain('creators');
    });

    it('should return health status from API', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data.status).toBe('healthy');
      expect(data).toHaveProperty('timestamp');
    });

    it('should handle API errors gracefully', async () => {
      const response = await fetch(`${baseUrl}/api/nonexistent`);
      expect(response.status).toBe(404);
    });
  });

  describe('API endpoints', () => {
    it('should return creators data', async () => {
      const response = await fetch(`${baseUrl}/api/creators`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('creators');
      expect(Array.isArray(data.creators)).toBe(true);
    });

    it('should handle creators search', async () => {
      const searchBody = {
        platforms: ['tiktok'],
        minFollowers: 1000,
      };

      const response = await fetch(`${baseUrl}/api/creators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchBody),
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('creators');
    });

    it('should handle platform filtering', async () => {
      const response = await fetch(`${baseUrl}/api/creators?platform=tiktok`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('creators');
    });

    it('should handle pagination', async () => {
      const response = await fetch(`${baseUrl}/api/creators?page=1&limit=5`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('creators');
      expect(data).toHaveProperty('totalCount');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON in POST requests', async () => {
      const response = await fetch(`${baseUrl}/api/creators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      expect(response.status).toBe(400);
    });

    it('should handle missing required parameters', async () => {
      const response = await fetch(`${baseUrl}/api/creators/invalid-id`);
      expect(response.status).toBe(404);
    });
  });

  describe('Performance', () => {
    it('should respond to health check within 1 second', async () => {
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/health`);
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should respond to creators API within 5 seconds', async () => {
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/creators?limit=10`);
      const endTime = Date.now();
      
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Content validation', () => {
    it('should return proper content-type headers', async () => {
      const apiResponse = await fetch(`${baseUrl}/api/health`);
      expect(apiResponse.headers.get('content-type')).toContain('application/json');
      
      const htmlResponse = await fetch(`${baseUrl}/creators`);
      expect(htmlResponse.headers.get('content-type')).toContain('text/html');
    });

    it('should include security headers', async () => {
      const response = await fetch(`${baseUrl}/`);
      
      // Check for common security headers
      expect(response.headers.get('x-frame-options')).toBeTruthy();
      expect(response.headers.get('x-content-type-options')).toBeTruthy();
    });
  });

  describe('Database connectivity', () => {
    it('should handle database operations', async () => {
      const response = await fetch(`${baseUrl}/api/creators`);
      expect(response.status).toBe(200);
      
      // If this succeeds, database connection is working
      const data = await response.json();
      expect(data).toHaveProperty('creators');
    });
  });
});