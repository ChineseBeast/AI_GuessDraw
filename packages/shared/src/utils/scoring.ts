import { SCORE_RULES } from '../constants/game';

/**
 * 格式化分数显示
 */
export function formatScore(score: number): string {
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}k`;
  }
  return score.toString();
}

/**
 * 计算时间奖励分数
 * @param timeRemaining 剩余秒数
 * @param totalTime 总秒数
 */
export function calculateTimeBonus(timeRemaining: number, _totalTime: number): number {
  if (timeRemaining <= 0) return 0;
  const bonus = Math.floor(timeRemaining * SCORE_RULES.timeBonus.perSecondRemaining);
  return Math.min(bonus, SCORE_RULES.timeBonus.max);
}

/**
 * 计算 AI 置信度奖励
 * @param confidence AI 识别置信度 (0-1)
 */
export function calculateConfidenceBonus(confidence: number): number {
  if (confidence < 0.5) return 0;
  const bonus = Math.floor(confidence * SCORE_RULES.aiConfidenceBonus.max);
  return Math.min(bonus, SCORE_RULES.aiConfidenceBonus.max);
}
