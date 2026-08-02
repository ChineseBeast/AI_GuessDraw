/** 用户信息 */
export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

/** 登录请求 */
export interface LoginRequest {
  username: string;
  password: string;
}

/** 注册请求 */
export interface RegisterRequest {
  username: string;
  email: string;
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
