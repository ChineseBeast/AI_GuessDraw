import type { LeaderboardResponse, LeaderboardPeriod } from '@draw-guess/shared';

const API_BASE = '/api/leaderboard';

export const LeaderboardService = {
  async getLeaderboard(period: LeaderboardPeriod = 'all', limit = 50, offset = 0): Promise<LeaderboardResponse> {
    const params = new URLSearchParams({ period, limit: String(limit), offset: String(offset) });
    const res = await fetch(`${API_BASE}?${params}`);

    if (!res.ok) {
      throw new Error('获取排行榜失败');
    }

    return res.json();
  },

  async submitResult(params: {
    playerId: string;
    nickname: string;
    score: number;
    won: boolean;
  }): Promise<void> {
    const res = await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      console.error('提交分数失败');
    }
  },
};
