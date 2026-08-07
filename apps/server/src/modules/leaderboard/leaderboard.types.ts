export interface LeaderboardRecord {
  playerId: string;
  nickname: string;
  avatarUrl?: string;
  totalScore: number;
  gamesPlayed: number;
  winCount: number;
  lastPlayedAt: Date;
}

export interface LeaderboardPeriodData {
  weekly: Map<string, LeaderboardRecord>;
  monthly: Map<string, LeaderboardRecord>;
  all: Map<string, LeaderboardRecord>;
}
