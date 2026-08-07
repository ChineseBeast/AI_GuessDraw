import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LeaderboardService } from './leaderboard.service';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LeaderboardService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('getLeaderboard', () => {
    it('should fetch leaderboard with correct URL and params', async () => {
      const mockData = {
        entries: [
          {
            playerId: 'u1',
            nickname: 'Alice',
            totalScore: 100,
            gamesPlayed: 5,
            winCount: 3,
            lastPlayedAt: '2026-01-01T00:00:00.000Z',
            rank: 1,
          },
        ],
        total: 1,
        period: 'weekly',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await LeaderboardService.getLeaderboard('weekly', 50, 0);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/leaderboard?period=weekly&limit=50&offset=0'),
      );
      expect(result.entries.length).toBe(1);
      expect(result.entries[0].playerId).toBe('u1');
      expect(result.entries[0].totalScore).toBe(100);
    });

    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(LeaderboardService.getLeaderboard('all')).rejects.toThrow('获取排行榜失败');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(LeaderboardService.getLeaderboard('all')).rejects.toThrow('Network error');
    });

    it('should use default parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ entries: [], total: 0, period: 'all' }),
      });

      await LeaderboardService.getLeaderboard('all');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=0'),
      );
    });
  });

  describe('submitResult', () => {
    it('should POST result data correctly', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await LeaderboardService.submitResult({
        playerId: 'u1',
        nickname: 'Alice',
        score: 42,
        won: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/leaderboard/submit',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: 'u1',
            nickname: 'Alice',
            score: 42,
            won: true,
          }),
        }),
      );
    });

    it('should not throw on failed submission (silent fail)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      // Should not throw
      await expect(
        LeaderboardService.submitResult({
          playerId: 'u1',
          nickname: 'Alice',
          score: 42,
          won: true,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
