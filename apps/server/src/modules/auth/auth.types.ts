export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
}

export interface JwtPayload {
  sub: string;       // userId
  username: string;
}
