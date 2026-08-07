import { Test, TestingModule } from '@nestjs/testing';
import { GameEngineService } from './game-engine.service';
import type { Room, GameState, RoundState } from '../types/websocket.types';

// Mock WordService
const mockWordService = {
  getRandomWord: () => ({ word: '苹果', difficulty: 'easy' as const }),
  getRandomWords: (_diff: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ word: `词汇${i + 1}`, difficulty: 'easy' as const })),
  checkGuess: (guess: string, target: string) => {
    if (guess === target) return { isCorrect: true, proximity: 'exact' as const };
    if (guess.length === target.length) return { isCorrect: false, proximity: 'length_match' as const };
    return { isCorrect: false, proximity: 'wrong' as const };
  },
};

function createMockRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room_test_1',
    inviteCode: 'ABC123',
    hostId: 'user_1',
    status: 'playing',
    maxPlayers: 4,
    difficulty: 'easy',
    createdAt: new Date(),
    players: new Map([
      ['user_1', { userId: 'user_1', nickname: 'Alice', role: 'guesser', score: 0, connectionStatus: 'connected', joinedAt: new Date(), socketId: 's1', sessionToken: 't1' }],
      ['user_2', { userId: 'user_2', nickname: 'Bob', role: 'guesser', score: 0, connectionStatus: 'connected', joinedAt: new Date(), socketId: 's2', sessionToken: 't2' }],
      ['user_3', { userId: 'user_3', nickname: 'Charlie', role: 'guesser', score: 0, connectionStatus: 'connected', joinedAt: new Date(), socketId: 's3', sessionToken: 't3' }],
    ]),
    spectators: new Map(),
    ...overrides,
  } as Room;
}

describe('GameEngineService', () => {
  let service: GameEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameEngineService],
    }).compile();

    service = module.get<GameEngineService>(GameEngineService);
  });

  describe('initGame', () => {
    it('should create a game with correct number of rounds', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);

      expect(game.totalRounds).toBe(6); // 3 players * 2
      expect(game.drawerOrder.length).toBe(3);
      expect(game.status).toBe('countdown');
      expect(game.currentRound).toBe(0);
      expect(game.wordPool.length).toBe(6);
    });

    it('should shuffle drawer order', () => {
      const room = createMockRoom();
      const orders = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const game = service.initGame(room, mockWordService as any);
        orders.add(game.drawerOrder.join(','));
        service.removeGame(room.id);
      }
      // With 3 players, there are 6 permutations — after 10 runs we should see variation
      expect(orders.size).toBeGreaterThan(1);
    });
  });

  describe('startRound', () => {
    it('should start a round with correct drawer and word', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);

      const round = service.startRound(game, mockWordService as any);

      expect(round.roundNumber).toBe(1);
      expect(game.drawerOrder).toContain(round.drawerId);
      expect(round.targetWord).toBeDefined();
      expect(round.status).toBe('active');
      expect(game.status).toBe('playing');
    });

    it('should increment round number', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);

      service.startRound(game, mockWordService as any);
      service.endRound(game, game.rounds[0], 'timeout');
      service.advanceToNextRound(game);

      const round2 = service.startRound(game, mockWordService as any);
      expect(round2.roundNumber).toBe(2);
    });
  });

  describe('endRound', () => {
    it('should mark round as completed', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);
      const round = service.startRound(game, mockWordService as any);

      service.endRound(game, round, 'all_guessed');

      expect(round.status).toBe('completed');
      expect(round.endedAt).toBeDefined();
      expect(game.status).toBe('round_end');
    });

    it('should clear timer on end', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);
      const round = service.startRound(game, mockWordService as any);

      expect(round.timerHandle).toBeDefined();
      service.endRound(game, round, 'timeout');
      // Timer should be cleared
      expect(round.timerHandle).toBeUndefined();
    });
  });

  describe('processGuess', () => {
    it('should award 15 points for first correct guess', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);
      const round = service.startRound(game, mockWordService as any);

      // Find a non-drawer player
      const guesserId = game.drawerOrder.find(id => id !== round.drawerId)!;
      const { guess, guesserRank } = service.processGuess(
        game, round, guesserId, round.targetWord, mockWordService as any,
      );

      expect(guess.isCorrect).toBe(true);
      expect(guesserRank).toBe(1);
      expect(guess.score).toBe(15);
    });

    it('should award 10 points for second correct guess', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);
      const round = service.startRound(game, mockWordService as any);

      const guessers = game.drawerOrder.filter(id => id !== round.drawerId);
      service.processGuess(game, round, guessers[0], round.targetWord, mockWordService as any);
      const { guess, guesserRank } = service.processGuess(
        game, round, guessers[1], round.targetWord, mockWordService as any,
      );

      expect(guess.isCorrect).toBe(true);
      expect(guesserRank).toBe(2);
      expect(guess.score).toBe(10);
    });

    it('should return proximity hints for wrong guesses', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);
      const round = service.startRound(game, mockWordService as any);

      const guesserId = game.drawerOrder.find(id => id !== round.drawerId)!;
      // Target is "词汇1" (3 chars), guess something of same length but wrong
      const { guess } = service.processGuess(
        game, round, guesserId, '三个字', mockWordService as any,
      );

      expect(guess.isCorrect).toBe(false);
      expect(guess.proximity).toBe('length_match');
      expect(guess.score).toBe(0);
    });
  });

  describe('calculateDrawerScore', () => {
    it('should award 5 points per correct guess', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);
      const round = service.startRound(game, mockWordService as any);

      const guessers = game.drawerOrder.filter(id => id !== round.drawerId);
      // Two players guess correctly
      service.processGuess(game, round, guessers[0], round.targetWord, mockWordService as any);
      service.processGuess(game, round, guessers[1], round.targetWord, mockWordService as any);

      const drawerScore = service.calculateDrawerScore(round);
      expect(drawerScore).toBe(10); // 5 * 2
    });
  });

  describe('advanceToNextRound', () => {
    it('should return true when more rounds remain', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);
      service.startRound(game, mockWordService as any);

      const hasMore = service.advanceToNextRound(game);
      expect(hasMore).toBe(true);
      expect(game.currentDrawerIndex).toBe(1);
    });

    it('should return false and set game_end when all rounds done', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);
      // Simulate playing all rounds
      game.currentRound = game.totalRounds;
      game.currentDrawerIndex = game.drawerOrder.length - 1;

      const hasMore = service.advanceToNextRound(game);
      expect(hasMore).toBe(false);
      expect(game.status).toBe('game_end');
    });
  });

  describe('getFinalScores', () => {
    it('should rank players by total score', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);

      // Simulate one round with scores
      const round = service.startRound(game, mockWordService as any);
      const guessers = game.drawerOrder.filter(id => id !== round.drawerId);
      service.processGuess(game, round, guessers[0], round.targetWord, mockWordService as any);

      // Manually add scores
      room.players.get(guessers[0])!.score = 15;
      room.players.get(round.drawerId)!.score = 5;

      service.endRound(game, round, 'all_guessed');
      game.currentRound = game.totalRounds;
      game.currentDrawerIndex = game.drawerOrder.length - 1;
      service.advanceToNextRound(game);

      const scores = service.getFinalScores(game, room);

      expect(scores.length).toBe(3);
      expect(scores[0].rank).toBe(1);
      expect(scores[0].totalScore).toBeGreaterThanOrEqual(scores[1].totalScore);
    });
  });

  describe('switchDrawer', () => {
    it('should change drawer and extend timer', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);
      const round = service.startRound(game, mockWordService as any);

      const oldDrawer = round.drawerId;
      const newDrawer = game.drawerOrder.find(id => id !== oldDrawer)!;

      service.switchDrawer(game, round, newDrawer);

      expect(round.drawerId).toBe(newDrawer);
      expect(round.drawerId).not.toBe(oldDrawer);
      expect(round.timerHandle).toBeDefined(); // New timer set
    });
  });

  describe('removeGame', () => {
    it('should clean up game and clear timers', () => {
      const room = createMockRoom();
      const game = service.initGame(room, mockWordService as any);
      const round = service.startRound(game, mockWordService as any);

      service.removeGame(room.id);

      const retrieved = service.getGame(room.id);
      expect(retrieved).toBeUndefined();
    });
  });
});
