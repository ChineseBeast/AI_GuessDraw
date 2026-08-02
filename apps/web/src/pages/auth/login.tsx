import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onNavigateToRegister: () => void;
  onSkip?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onNavigateToRegister, onSkip }) => {
  const { login, loading, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    try {
      await login(username.trim(), password);
      onLoginSuccess();
    } catch {
      // error handled by useAuth
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>🔐 登录</h1>

      {error && (
        <div style={{
          padding: '0.75rem', marginBottom: '1rem', background: '#ffebee',
          color: '#c62828', borderRadius: '8px', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828' }}>✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold' }}>用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名"
            autoFocus
            style={{
              width: '100%', padding: '0.75rem', fontSize: '1rem',
              borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold' }}>密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            style={{
              width: '100%', padding: '0.75rem', fontSize: '1rem',
              borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !username.trim() || !password.trim()}
          style={{
            width: '100%', padding: '0.75rem', fontSize: '1.1rem',
            background: loading ? '#ccc' : '#2196f3', color: 'white',
            border: 'none', borderRadius: '8px', cursor: loading ? 'default' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          {loading ? '登录中...' : '登 录'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <button
          onClick={onNavigateToRegister}
          style={{ background: 'none', border: 'none', color: '#2196f3', cursor: 'pointer', fontSize: '0.95rem' }}
        >
          没有账号？去注册 →
        </button>
      </div>

      {onSkip && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            onClick={onSkip}
            style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            跳过登录，游客体验 →
          </button>
        </div>
      )}
    </div>
  );
};
