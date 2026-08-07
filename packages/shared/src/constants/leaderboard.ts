import type { LeaderboardPeriod } from '../types/leaderboard.js';

/** 排行榜默认返回条数 */
export const DEFAULT_LEADERBOARD_LIMIT = 50;

/** 排行榜周期选项 */
export const LEADERBOARD_PERIODS: { period: LeaderboardPeriod; label: string }[] = [
  { period: 'weekly', label: '本周' },
  { period: 'monthly', label: '本月' },
  { period: 'all', label: '全部' },
];
