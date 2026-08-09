export type UserRole = 'user' | 'admin';

export interface UserRecord {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  role: UserRole;
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
  sub: string; // userId
  username: string;
  role: UserRole;
}

export type PublicUserProfile = Omit<UserRecord, 'passwordHash'>;
