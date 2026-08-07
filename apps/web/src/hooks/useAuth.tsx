import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { AuthService } from '../services/auth.service';

export interface User {
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
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  initializing: boolean;
  login: (username: string, password: string) => Promise<{ user: User; accessToken: string }>;
  register: (username: string, password: string, email?: string) => Promise<{ user: User; accessToken: string }>;
  logout: () => void;
  updateProfile: (updates: { username?: string; email?: string; avatar?: string }) => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => AuthService.getUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  // 启动时验证 Token（刷新后恢复会话）
  useEffect(() => {
    const token = AuthService.getToken();
    if (token && !user) {
      AuthService.getMe()
        .then((u) => {
          if (u) setUser(u);
          else AuthService.clearAuth();
        })
        .catch(() => {
          AuthService.clearAuth();
        })
        .finally(() => {
          setInitializing(false);
        });
    } else {
      setInitializing(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await AuthService.login(username, password);
      setUser(result.user as User);
      return result as { user: User; accessToken: string };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (username: string, password: string, email?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await AuthService.register(username, password, email);
      setUser(result.user as User);
      return result as { user: User; accessToken: string };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '注册失败';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    AuthService.clearAuth();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (updates: { username?: string; email?: string; avatar?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const updatedUser = (await AuthService.updateProfile(updates)) as User;
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '更新失败';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    setLoading(true);
    setError(null);
    try {
      await AuthService.changePassword(currentPassword, newPassword);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '修改密码失败';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      await AuthService.deleteAccount(password);
      setUser(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '注销账号失败';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const u = (await AuthService.getMe()) as User | null;
    if (u) setUser(u);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    loading,
    error,
    initializing,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    deleteAccount,
    refreshUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth 必须在 <AuthProvider> 内部使用');
  }
  return ctx;
}
