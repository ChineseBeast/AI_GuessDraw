export interface DashboardStats {
  users: {
    total: number;
    admins: number;
    newToday: number;
  };
  rooms: {
    active: number;
    playing: number;
    waiting: number;
  };
  games: {
    totalPlayed: number;
    totalWins: number;
  };
  leaderboard: {
    weeklyCount: number;
    monthlyCount: number;
    allTimeCount: number;
  };
}

export interface AdminUserList {
  users: {
    id: string;
    username: string;
    email?: string;
    avatar?: string;
    role: string;
    createdAt: string;
    updatedAt: string;
    stats: {
      gamesPlayed: number;
      gamesWon: number;
      totalScore: number;
      currentStreak: number;
    };
  }[];
  total: number;
}

export interface AdminRoomList {
  rooms: {
    id: string;
    inviteCode: string;
    hostId: string;
    status: string;
    maxPlayers: number;
    difficulty: string;
    createdAt: string;
    playerCount: number;
    spectatorCount: number;
  }[];
  total: number;
}
