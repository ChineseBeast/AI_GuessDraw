import { describe, it, expect } from 'vitest';
import { TOTAL_ROUNDS, ROUND_TIME } from '@draw-guess/shared';

/**
 * 单机模式评分逻辑测试（纯函数，不依赖 React）
 *
 * 评分规则：
 * - baseScore: 猜对=10, 猜错=1(user_draws)/0(ai_draws)
 * - timeBonus: floor(timeRemaining * 0.1), max 5
 * - confidenceBonus: floor(confidence * 5), max 5 (仅 user_draws)
 */

interface ScoreBreakdown {
  baseScore: number;
  timeBonus: number;
  confidenceBonus: number;
  total: number;
}

function calculateScore(
  isCorrect: boolean,
  timeRemaining: number,
  confidence?: number,
  role: 'user_draws' | 'ai_draws' = 'user_draws',
): ScoreBreakdown {
  if (!isCorrect) {
    if (role === 'user_draws') {
      return { baseScore: 1, timeBonus: 0, confidenceBonus: 0, total: 1 };
    }
    return { baseScore: 0, timeBonus: 0, confidenceBonus: 0, total: 0 };
  }

  const baseScore = 10;
  const timeBonus = Math.min(Math.floor(timeRemaining * 0.1), 5);
  const confidenceBonus =
    role === 'user_draws' && confidence !== undefined
      ? Math.min(Math.floor(confidence * 5), 5)
      : 0;

  return {
    baseScore,
    timeBonus,
    confidenceBonus,
    total: baseScore + timeBonus + confidenceBonus,
  };
}

describe('SinglePlayer Scoring Logic', () => {
  describe('calculateScore — correct guesses', () => {
    it('should give base 10 + time bonus + confidence bonus', () => {
      const score = calculateScore(true, 42, 0.95, 'user_draws');

      expect(score.baseScore).toBe(10);
      expect(score.timeBonus).toBe(4); // floor(42 * 0.1) = 4
      expect(score.confidenceBonus).toBe(4); // floor(0.95 * 5) = 4
      expect(score.total).toBe(18);
    });

    it('should cap time bonus at 5', () => {
      const score = calculateScore(true, 60, 0.9, 'user_draws');
      expect(score.timeBonus).toBe(5);
    });

    it('should cap confidence bonus at 5', () => {
      const score = calculateScore(true, 30, 1.0, 'user_draws');
      expect(score.confidenceBonus).toBe(5);
    });

    it('should give zero time bonus when timeRemaining is 0', () => {
      const score = calculateScore(true, 0, 0.9, 'user_draws');
      expect(score.timeBonus).toBe(0);
      expect(score.total).toBe(14); // 10 + 0 + 4
    });

    it('should give zero confidence bonus for ai_draws role', () => {
      const score = calculateScore(true, 30, 0.9, 'ai_draws');
      expect(score.confidenceBonus).toBe(0);
      expect(score.total).toBe(13); // 10 + 3 + 0
    });

    it('should handle undefined confidence gracefully', () => {
      const score = calculateScore(true, 30, undefined, 'user_draws');
      expect(score.confidenceBonus).toBe(0);
      expect(score.total).toBe(13); // 10 + 3 + 0
    });
  });

  describe('calculateScore — incorrect guesses', () => {
    it('should give minimal score for incorrect user drawing', () => {
      const score = calculateScore(false, 30, undefined, 'user_draws');
      expect(score.total).toBe(1);
      expect(score.baseScore).toBe(1);
    });

    it('should give zero score for incorrect ai_draws guess', () => {
      const score = calculateScore(false, 30, undefined, 'ai_draws');
      expect(score.total).toBe(0);
    });
  });

  describe('calculateScore — edge cases', () => {
    it('should handle timeRemaining > 50 (time bonus capped)', () => {
      const score = calculateScore(true, 100, 1.0, 'user_draws');
      expect(score.timeBonus).toBe(5);
      expect(score.confidenceBonus).toBe(5);
      expect(score.total).toBe(20); // max possible
    });

    it('should handle zero confidence', () => {
      const score = calculateScore(true, 30, 0, 'user_draws');
      expect(score.confidenceBonus).toBe(0);
    });

    it('should handle very low confidence', () => {
      const score = calculateScore(true, 30, 0.19, 'user_draws');
      expect(score.confidenceBonus).toBe(0); // floor(0.19 * 5) = 0
    });

    it('should handle confidence just above threshold', () => {
      const score = calculateScore(true, 30, 0.2, 'user_draws');
      expect(score.confidenceBonus).toBe(1); // floor(0.2 * 5) = 1
    });
  });

  describe('Game config constants', () => {
    it('TOTAL_ROUNDS should be 5', () => {
      expect(TOTAL_ROUNDS).toBe(5);
    });

    it('ROUND_TIME should be 60', () => {
      expect(ROUND_TIME).toBe(60);
    });
  });
});
