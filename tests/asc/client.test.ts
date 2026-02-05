import { ASCAPIError, ASCAuthError } from '../../src/asc/errors';

// Mock the auth module before importing client
jest.mock('../../src/asc/auth', () => ({
  getToken: jest.fn().mockResolvedValue('mock-jwt-token'),
}));

import { get, getAllPages, resetRateLimiter } from '../../src/asc/client';

// Save original fetch
const originalFetch = global.fetch;

describe('ASC Client', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    resetRateLimiter();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('get', () => {
    it('should make authenticated GET request', async () => {
      const mockData = { data: { id: '123', type: 'apps' } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      const result = await get('/apps');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.appstoreconnect.apple.com/v1/apps',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
          }),
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should append query parameters', async () => {
      const mockData = { data: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      await get('/apps', { 'filter[bundleId]': 'com.test.app', limit: 10 });

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain('filter%5BbundleId%5D=com.test.app');
      expect(calledUrl).toContain('limit=10');
    });

    it('should skip undefined parameters', async () => {
      const mockData = { data: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      await get('/apps', { 'filter[bundleId]': 'com.test.app', limit: undefined });

      const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain('filter%5BbundleId%5D=com.test.app');
      expect(calledUrl).not.toContain('limit');
    });
  });

  describe('error handling', () => {
    it('should throw ASCAuthError on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        text: async () => JSON.stringify({ errors: [{ detail: 'Unauthorized' }] }),
      });

      await expect(get('/apps')).rejects.toThrow(ASCAuthError);
    });

    it('should throw ASCAuthError on 403', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers(),
        text: async () => JSON.stringify({ errors: [{ detail: 'Forbidden' }] }),
      });

      await expect(get('/apps')).rejects.toThrow(ASCAuthError);
    });

    it('should throw ASCAPIError on other errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            errors: [{ title: 'Not Found', detail: 'App not found', status: '404' }],
          }),
      });

      await expect(get('/apps/123')).rejects.toThrow(ASCAPIError);
    });

    it('should retry on 429 with Retry-After header', async () => {
      // First call returns 429
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '1' }),
          text: async () => '',
        })
        // Second call succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        });

      const result = await get('/apps');

      expect(result).toEqual({ data: [] });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx errors', async () => {
      // First call returns 500
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
          text: async () => '',
        })
        // Second call succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        });

      const result = await get('/apps');

      expect(result).toEqual({ data: [] });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAllPages', () => {
    it('should fetch all pages', async () => {
      // Page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: '1', type: 'apps' }],
          links: { next: 'https://api.appstoreconnect.apple.com/v1/apps?cursor=abc' },
        }),
      });
      // Page 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: '2', type: 'apps' }],
          links: {},
        }),
      });

      const results = await getAllPages('/apps');

      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe('1');
      expect(results[1]?.id).toBe('2');
    });

    it('should respect maxPages limit', async () => {
      // Page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: '1', type: 'apps' }],
          links: { next: 'https://api.appstoreconnect.apple.com/v1/apps?cursor=abc' },
        }),
      });

      const results = await getAllPages('/apps', undefined, 1);

      expect(results).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
