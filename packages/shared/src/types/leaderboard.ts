import type { GameMode } from './game.js';

/** 排行榜周期 */
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all';

/** 排行榜条目 */
export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  avatarUrl?: string;
  totalScore: number;
  gamesPlayed: number;
  winCount: number;
  lastPlayedAt: string;
  rank: number;
}

/** 排行榜查询参数 */
export interface LeaderboardQuery {
  period: LeaderboardPeriod;
  limit?: number;
  offset?: number;
}

/** 排行榜响应 */
export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  period: LeaderboardPeriod;
}

/** 游戏结果提交 */
export interface GameResultSubmit {
  playerId: string;
  nickname: string;
  score: number;
  mode: GameMode;
  won: boolean;
  rounds: number;
}
