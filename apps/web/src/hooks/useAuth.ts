import { useState, useCallback, useEffect } from 'react';
import { AuthService } from '../services/auth.service';

interface User {
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

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => AuthService.getUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 启动时验证 Token
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
        });
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await AuthService.login(username, password);
      setUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
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
      setUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
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
      const updatedUser = await AuthService.updateProfile(updates);
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
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
      setError(err instanceof Error ? err.message : '修改密码失败');
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
      setError(err instanceof Error ? err.message : '注销账号失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await AuthService.getMe();
    setUser(u);
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    deleteAccount,
    refreshUser,
    clearError: () => setError(null),
  };
}
