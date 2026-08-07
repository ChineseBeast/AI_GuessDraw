import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface RegisterPageProps {
  onRegisterSuccess: () => void;
  onNavigateToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onRegisterSuccess, onNavigateToLogin }) => {
  const { register, loading, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!username.trim()) {
      setValidationError('请输入用户名');
      return;
    }
    if (username.trim().length < 2) {
      setValidationError('用户名至少 2 个字符');
      return;
    }
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setValidationError('邮箱格式不正确');
        return;
      }
    }
    if (password.length < 6) {
      setValidationError('密码至少 6 位');
      return;
    }
    if (password !== confirmPassword) {
      setValidationError('两次密码输入不一致');
      return;
    }

    try {
      await register(username.trim(), password, email || undefined);
      onRegisterSuccess();
    } catch {
      // error handled by useAuth
    }
  };

  const displayError = validationError || error;

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>📝 注册</h1>

      {displayError && (
        <div style={{
          padding: '0.75rem', marginBottom: '1rem', background: '#ffebee',
          color: '#c62828', borderRadius: '8px', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{displayError}</span>
          <button onClick={() => { clearError(); setValidationError(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828' }}>✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold' }}>用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="2-20 个字符"
            autoFocus
            style={{
              width: '100%', padding: '0.75rem', fontSize: '1rem',
              borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold' }}>邮箱（选填）</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            style={{
              width: '100%', padding: '0.75rem', fontSize: '1rem',
              borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold' }}>密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 位"
            style={{
              width: '100%', padding: '0.75rem', fontSize: '1rem',
              borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold' }}>确认密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再次输入密码"
            style={{
              width: '100%', padding: '0.75rem', fontSize: '1rem',
              borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '0.75rem', fontSize: '1.1rem',
            background: loading ? '#ccc' : '#4caf50', color: 'white',
            border: 'none', borderRadius: '8px', cursor: loading ? 'default' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          {loading ? '注册中...' : '注 册'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <button
          onClick={onNavigateToLogin}
          style={{ background: 'none', border: 'none', color: '#2196f3', cursor: 'pointer', fontSize: '0.95rem' }}
        >
          ← 已有账号？去登录
        </button>
      </div>
    </div>
  );
};
