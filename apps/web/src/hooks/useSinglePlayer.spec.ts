import { describe, it, expect } from 'vitest';
import { TOTAL_ROUNDS, ROUND_TIME } from '@draw-guess/shared';
import { calculateRoundScore } from './useSinglePlayer';

/**
 * 单机模式评分逻辑测试（纯函数，不依赖 React）
 *
 * 评分规则：猜对一轮加 1 分，谁猜对给谁加分。
 * - user_draws（用户画 AI 猜）：AI 猜对则 AI +1，否则用户 +1
 * - ai_draws（AI 画 用户猜）：用户猜对则用户 +1，否则 AI +1
 */

describe('SinglePlayer Scoring Logic', () => {
  describe('calculateRoundScore - user_draws (用户画 AI 猜)', () => {
    it('AI 猜对时 AI 得分', () => {
      const score = calculateRoundScore(true, 'user_draws');
      expect(score.aiGain).toBe(1);
      expect(score.userGain).toBe(0);
    });

    it('AI 没猜对时用户得分', () => {
      const score = calculateRoundScore(false, 'user_draws');
      expect(score.userGain).toBe(1);
      expect(score.aiGain).toBe(0);
    });
  });

  describe('calculateRoundScore - ai_draws (AI 画 用户猜)', () => {
    it('用户猜对时用户得分', () => {
      const score = calculateRoundScore(true, 'ai_draws');
      expect(score.userGain).toBe(1);
      expect(score.aiGain).toBe(0);
    });

    it('用户没猜对时 AI 得分', () => {
      const score = calculateRoundScore(false, 'ai_draws');
      expect(score.aiGain).toBe(1);
      expect(score.userGain).toBe(0);
    });
  });

  describe('calculateRoundScore - 每轮总分恒为 1', () => {
    it('任意情况下 userGain + aiGain 应等于 1', () => {
      const cases: Array<[boolean, 'user_draws' | 'ai_draws']> = [
        [true, 'user_draws'],
        [false, 'user_draws'],
        [true, 'ai_draws'],
        [false, 'ai_draws'],
      ];
      for (const [isCorrect, role] of cases) {
        const score = calculateRoundScore(isCorrect, role);
        expect(score.userGain + score.aiGain).toBe(1);
      }
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
