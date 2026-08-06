/** 用户统计数据 */
export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  currentStreak: number;
}

/** 用户信息 */
export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  stats?: UserStats;
}

/** 登录请求 */
export interface LoginRequest {
  username: string;
  password: string;
}

/** 注册请求 */
export interface RegisterRequest {
  username: string;
  email?: string;
  password: string;
}

/** 微信登录请求 */
export interface WechatLoginRequest {
  code: string;
}

/** 认证令牌 */
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/** 游客用户 */
export interface GuestUser {
  id: string;
  nickname: string;
  sessionId: string;
}

/** 更新用户资料请求 */
export interface UpdateProfileRequest {
  username?: string;
  email?: string;
  avatar?: string;
}

/** 修改密码请求 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** 认证响应 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}
