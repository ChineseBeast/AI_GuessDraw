import { useState, useEffect, useCallback } from 'react';
import type { LeaderboardEntry, LeaderboardPeriod } from '@draw-guess/shared';
import { LEADERBOARD_PERIODS } from '@draw-guess/shared';
import { LeaderboardService } from '../services/leaderboard.service';

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchLeaderboard = useCallback(async (p: LeaderboardPeriod) => {
    setLoading(true);
    setError(null);

    try {
      const data = await LeaderboardService.getLeaderboard(p);
      setEntries(data.entries);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取排行榜失败');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(period);
  }, [period, fetchLeaderboard]);

  const changePeriod = useCallback((p: LeaderboardPeriod) => {
    setPeriod(p);
  }, []);

  return {
    entries,
    period,
    periods: LEADERBOARD_PERIODS,
    loading,
    error,
    total,
    changePeriod,
    refresh: () => fetchLeaderboard(period),
  };
}
