const API_BASE = '/api/auth';

interface AuthResponse {
  user: {
    id: string;
    username: string;
    email?: string;
    avatar?: string;
    role: 'user' | 'admin';
    createdAt: string;
    updatedAt: string;
    stats?: {
      gamesPlayed: number;
      gamesWon: number;
      totalScore: number;
      currentStreak: number;
    };
  };
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

const TOKEN_KEY = 'draw_guess_token';
const USER_KEY = 'draw_guess_user';

export const AuthService = {
  async register(username: string, password: string, email?: string): Promise<AuthResponse> {
    const body: Record<string, string> = { username, password };
    if (email) body.email = email;

    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: '注册失败' }));
      throw new Error(err.message || '注册失败');
    }

    const data: AuthResponse = await res.json();
    AuthService.saveToken(data.accessToken);
    AuthService.saveUser(data.user);
    return data;
  },

  async login(username: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: '登录失败' }));
      throw new Error(err.message || '登录失败');
    }

    const data: AuthResponse = await res.json();
    AuthService.saveToken(data.accessToken);
    AuthService.saveUser(data.user);
    return data;
  },

  async getMe(): Promise<AuthResponse['user'] | null> {
    const token = AuthService.getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        AuthService.clearAuth();
        return null;
      }

      const data = await res.json();
      return data.user;
    } catch {
      return null;
    }
  },

  async updateProfile(updates: { username?: string; email?: string; avatar?: string }): Promise<AuthResponse['user']> {
    const token = AuthService.getToken();
    if (!token) throw new Error('未登录');

    const res = await fetch(`${API_BASE}/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: '更新失败' }));
      throw new Error(err.message || '更新失败');
    }

    const data = await res.json();
    AuthService.saveUser(data.user);
    return data.user;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const token = AuthService.getToken();
    if (!token) throw new Error('未登录');

    const res = await fetch(`${API_BASE}/me/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: '修改密码失败' }));
      throw new Error(err.message || '修改密码失败');
    }
  },

  async deleteAccount(password: string): Promise<void> {
    const token = AuthService.getToken();
    if (!token) throw new Error('未登录');

    const res = await fetch(`${API_BASE}/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: '注销账号失败' }));
      throw new Error(err.message || '注销账号失败');
    }

    AuthService.clearAuth();
  },

  async getUserById(id: string): Promise<AuthResponse['user'] | null> {
    try {
      const res = await fetch(`${API_BASE}/profile/${id}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || null;
    } catch {
      return null;
    }
  },

  async getUserByUsername(username: string): Promise<AuthResponse['user'] | null> {
    try {
      const res = await fetch(`${API_BASE}/profile/username/${encodeURIComponent(username)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || null;
    } catch {
      return null;
    }
  },

  // Token 管理
  saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  saveUser(user: AuthResponse['user']): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  getUser(): AuthResponse['user'] | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isAuthenticated(): boolean {
    return !!AuthService.getToken();
  },
};
