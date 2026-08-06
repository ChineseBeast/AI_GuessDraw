export interface UserRecord {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    totalScore: number;
    currentStreak: number;
  };
}

export interface JwtPayload {
  sub: string;       // userId
  username: string;
}

export type PublicUserProfile = Omit<UserRecord, 'passwordHash'>;

