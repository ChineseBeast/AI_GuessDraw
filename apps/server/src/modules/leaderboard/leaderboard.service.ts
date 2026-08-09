import { Injectable } from '@nestjs/common';
import type { LeaderboardPeriod } from '@draw-guess/shared';
import type { LeaderboardRecord } from './leaderboard.types';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class LeaderboardService {
  // 三段时间范围的数据存储
  private weekly = new Map<string, LeaderboardRecord>();
  private monthly = new Map<string, LeaderboardRecord>();
  private allTime = new Map<string, LeaderboardRecord>();

  constructor(private readonly authService: AuthService) {}

  /**
   * 提交游戏结果
   */
  submitResult(params: {
    playerId: string;
    nickname: string;
    score: number;
    won: boolean;
  }): void {
    const now = new Date();

    const updateRecord = (store: Map<string, LeaderboardRecord>) => {
      const existing = store.get(params.playerId);
      if (existing) {
        existing.totalScore += params.score;
        existing.gamesPlayed += 1;
        if (params.won) existing.winCount += 1;
        existing.nickname = params.nickname; // 更新昵称
        existing.lastPlayedAt = now;
      } else {
        store.set(params.playerId, {
          playerId: params.playerId,
          nickname: params.nickname,
          totalScore: params.score,
          gamesPlayed: 1,
          winCount: params.won ? 1 : 0,
          lastPlayedAt: now,
        });
      }
    };

    // 同时更新三个时间范围
    updateRecord(this.weekly);
    updateRecord(this.monthly);
    updateRecord(this.allTime);

    // 同步更新用户统计（用户不存在则跳过，不影响排行榜记录）
    const user = this.authService.getUserById(params.playerId);
    if (user) {
      this.authService.updateStats(params.playerId, {
        gamesPlayed: user.stats.gamesPlayed + 1,
        gamesWon: user.stats.gamesWon + (params.won ? 1 : 0),
        totalScore: user.stats.totalScore + params.score,
        currentStreak: params.won ? user.stats.currentStreak + 1 : 0,
      });
    }
  }

  /**
   * 获取排行榜
   */
  getLeaderboard(period: LeaderboardPeriod, limit = 50, offset = 0) {
    const store = this.getStore(period);
    const entries = Array.from(store.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((record, index) => ({
        playerId: record.playerId,
        nickname: record.nickname,
        avatarUrl: record.avatarUrl,
        totalScore: record.totalScore,
        gamesPlayed: record.gamesPlayed,
        winCount: record.winCount,
        lastPlayedAt: record.lastPlayedAt.toISOString(),
        rank: index + 1,
      }));

    const total = entries.length;
    const paginated = entries.slice(offset, offset + limit);

    return {
      entries: paginated,
      total,
      period,
    };
  }

  /**
   * 清理过期数据（周榜：清理上周数据；月榜：清理上月数据）
   */
  cleanup(): void {
    const now = new Date();

    // 周榜：清理超过 7 天未活动的记录
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    for (const [key, record] of this.weekly) {
      if (record.lastPlayedAt < weekAgo) {
        this.weekly.delete(key);
      }
    }

    // 月榜：清理超过 30 天未活动的记录
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    for (const [key, record] of this.monthly) {
      if (record.lastPlayedAt < monthAgo) {
        this.monthly.delete(key);
      }
    }
  }

  private getStore(period: LeaderboardPeriod): Map<string, LeaderboardRecord> {
    switch (period) {
      case 'weekly':
        return this.weekly;
      case 'monthly':
        return this.monthly;
      case 'all':
        return this.allTime;
    }
  }
}
