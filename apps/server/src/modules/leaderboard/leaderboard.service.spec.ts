import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from './leaderboard.service';
import { AuthService } from '../auth/auth.service';

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        {
          provide: AuthService,
          useValue: {
            getUserById: jest.fn(() => null),
            updateStats: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  describe('submitResult', () => {
    it('should create a new record on first submission', () => {
      service.submitResult({
        playerId: 'u1',
        nickname: 'Alice',
        score: 42,
        won: true,
      });

      const board = service.getLeaderboard('all');
      expect(board.entries.length).toBe(1);
      expect(board.entries[0].playerId).toBe('u1');
      expect(board.entries[0].nickname).toBe('Alice');
      expect(board.entries[0].totalScore).toBe(42);
      expect(board.entries[0].gamesPlayed).toBe(1);
      expect(board.entries[0].winCount).toBe(1);
      expect(board.entries[0].rank).toBe(1);
    });

    it('should accumulate score on multiple submissions', () => {
      service.submitResult({ playerId: 'u1', nickname: 'Alice', score: 10, won: false });
      service.submitResult({ playerId: 'u1', nickname: 'Alice', score: 20, won: true });

      const board = service.getLeaderboard('all');
      expect(board.entries.length).toBe(1);
      expect(board.entries[0].totalScore).toBe(30);
      expect(board.entries[0].gamesPlayed).toBe(2);
      expect(board.entries[0].winCount).toBe(1);
    });

    it('should update nickname on subsequent submissions', () => {
      service.submitResult({ playerId: 'u1', nickname: 'Alice', score: 10, won: false });
      service.submitResult({ playerId: 'u1', nickname: 'AliceUpdated', score: 5, won: false });

      const board = service.getLeaderboard('all');
      expect(board.entries[0].nickname).toBe('AliceUpdated');
    });

    it('should update all three period stores', () => {
      service.submitResult({ playerId: 'u1', nickname: 'Alice', score: 10, won: true });

      expect(service.getLeaderboard('weekly').total).toBe(1);
      expect(service.getLeaderboard('monthly').total).toBe(1);
      expect(service.getLeaderboard('all').total).toBe(1);
    });
  });

  describe('getLeaderboard', () => {
    beforeEach(() => {
      service.submitResult({ playerId: 'u1', nickname: 'Alice', score: 50, won: true });
      service.submitResult({ playerId: 'u2', nickname: 'Bob', score: 30, won: false });
      service.submitResult({ playerId: 'u3', nickname: 'Charlie', score: 80, won: true });
      service.submitResult({ playerId: 'u4', nickname: 'Diana', score: 10, won: false });
    });

    it('should return entries sorted by totalScore descending', () => {
      const board = service.getLeaderboard('all');
      const scores = board.entries.map((e) => e.totalScore);
      expect(scores).toEqual([80, 50, 30, 10]);
    });

    it('should assign correct ranks', () => {
      const board = service.getLeaderboard('all');
      expect(board.entries[0].rank).toBe(1);
      expect(board.entries[1].rank).toBe(2);
      expect(board.entries[3].rank).toBe(4);
    });

    it('should paginate with limit and offset', () => {
      const board = service.getLeaderboard('all', 2, 0);
      expect(board.entries.length).toBe(2);
      expect(board.total).toBe(4);
      expect(board.entries[0].playerId).toBe('u3');

      const page2 = service.getLeaderboard('all', 2, 2);
      expect(page2.entries.length).toBe(2);
      expect(page2.entries[0].playerId).toBe('u2');
    });

    it('should respect period parameter', () => {
      service.submitResult({ playerId: 'u5', nickname: 'Eve', score: 99, won: true });
      // All periods should contain the data
      expect(service.getLeaderboard('weekly').total).toBe(5);
      expect(service.getLeaderboard('monthly').total).toBe(5);
      expect(service.getLeaderboard('all').total).toBe(5);
    });

    it('should return empty entries for empty leaderboard', () => {
      const emptyService = new LeaderboardService(
        { getUserById: jest.fn(() => null), updateStats: jest.fn() } as unknown as AuthService,
      );
      const board = emptyService.getLeaderboard('all');
      expect(board.entries).toEqual([]);
      expect(board.total).toBe(0);
    });

    it('should include ISO date string for lastPlayedAt', () => {
      const board = service.getLeaderboard('all');
      expect(board.entries[0].lastPlayedAt).toBeDefined();
      expect(() => new Date(board.entries[0].lastPlayedAt)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should not remove recent records', () => {
      service.submitResult({ playerId: 'u1', nickname: 'Alice', score: 10, won: true });
      service.cleanup();

      expect(service.getLeaderboard('weekly').total).toBe(1);
    });

    it('should remove stale weekly records', () => {
      service.submitResult({ playerId: 'u1', nickname: 'Alice', score: 10, won: true });

      // Manually set lastPlayedAt to 8 days ago
      const weeklyStore = (service as any).weekly;
      const record = weeklyStore.get('u1');
      record.lastPlayedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

      service.cleanup();
      expect(service.getLeaderboard('weekly').total).toBe(0);
      // But monthly and all-time should still have it
      expect(service.getLeaderboard('monthly').total).toBe(1);
      expect(service.getLeaderboard('all').total).toBe(1);
    });

    it('should remove stale monthly records', () => {
      service.submitResult({ playerId: 'u1', nickname: 'Alice', score: 10, won: true });

      const monthlyStore = (service as any).monthly;
      const record = monthlyStore.get('u1');
      record.lastPlayedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

      service.cleanup();
      expect(service.getLeaderboard('monthly').total).toBe(0);
      expect(service.getLeaderboard('all').total).toBe(1);
    });
  });
});
