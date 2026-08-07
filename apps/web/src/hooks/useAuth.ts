import { useState, useCallback, useEffect } from 'react';
import { AuthService } from '../services/auth.service';

interface User {
  id: string;
  username: string;
  createdAt: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => AuthService.getUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 启动时验证 Token
  useEffect(() => {
    const token = AuthService.getToken();
    if (token && !user) {
      AuthService.getMe().then((u) => {
        if (u) setUser(u);
        else AuthService.clearAuth();
      }).catch(() => {
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

  const register = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await AuthService.register(username, password);
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

  return {
    user,
    isAuthenticated: !!user,
    loading,
    error,
    login,
    register,
    logout,
    clearError: () => setError(null),
  };
}
