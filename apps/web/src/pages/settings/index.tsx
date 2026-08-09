import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface SettingsPageProps {
  onNavigateHome: () => void;
  onNavigateProfile: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigateHome, onNavigateProfile }) => {
  const { user, changePassword, deleteAccount, logout, loading, error, clearError } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!user) {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <p>请先登录</p>
        <button onClick={onNavigateHome} style={buttonStyle}>返回首页</button>
      </div>
    );
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    clearError();

    if (!currentPassword) {
      return;
    }
    if (newPassword.length < 6) {
      return;
    }
    if (newPassword !== confirmPassword) {
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      setSuccessMessage('密码修改成功');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      // error handled by useAuth
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount(deletePassword);
      // After account deletion, useAuth will set user to null
      onNavigateHome();
    } catch {
      // error handled by useAuth
    }
  };

  const handleLogout = () => {
    logout();
    onNavigateHome();
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>⚙️ 设置</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onNavigateProfile} style={secondaryButtonStyle}>👤 资料</button>
          <button onClick={onNavigateHome} style={secondaryButtonStyle}>← 返回</button>
        </div>
      </div>

      {error && (
        <div style={{ ...errorBannerStyle, marginBottom: '1rem' }}>
          <span>{error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828' }}>✕</button>
        </div>
      )}

      {successMessage && (
        <div style={{ ...successBannerStyle, marginBottom: '1rem' }}>
          <span>{successMessage}</span>
        </div>
      )}

      {/* 修改密码 */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0 }}>🔐 修改密码</h3>
        <form onSubmit={handleChangePassword}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold' }}>当前密码</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="输入当前密码"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold' }}>新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 6 位"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold' }}>确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
            style={{
              ...primaryButtonStyle,
              width: '100%',
              background: loading ? '#ccc' : '#4caf50',
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading ? '修改中...' : '修改密码'}
          </button>
        </form>
      </div>

      {/* 退出登录 */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0 }}>🚪 账号</h3>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
          用户名: <strong>{user.username}</strong>
          {user.email && <><br />邮箱: <strong>{user.email}</strong></>}
        </p>

        <button onClick={handleLogout} style={{ ...buttonStyle, width: '100%', background: '#ff9800', marginBottom: '0.5rem' }}>
          退出登录
        </button>

        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)} style={{ ...buttonStyle, width: '100%', background: '#f44336' }}>
            注销账号
          </button>
        ) : (
          <div style={{ padding: '1rem', background: '#ffebee', borderRadius: '8px' }}>
            <p style={{ color: '#c62828', marginBottom: '1rem', fontSize: '0.9rem' }}>
              ⚠️ 注销账号将永久删除您的所有数据，此操作无法撤销。
            </p>

            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="输入密码确认"
              style={{ ...inputStyle, marginBottom: '1rem' }}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleDeleteAccount}
                disabled={loading || !deletePassword}
                style={{
                  ...primaryButtonStyle,
                  flex: 1,
                  background: loading ? '#ccc' : '#f44336',
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                {loading ? '处理中...' : '确认注销'}
              </button>
              <button onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }} style={secondaryButtonStyle}>
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem', fontSize: '1rem',
  borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.9rem',
  color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '0.75rem 1.5rem', fontSize: '1rem',
  color: 'white', border: 'none', borderRadius: '8px',
  cursor: 'pointer', fontWeight: 'bold',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.9rem',
  background: '#f5f5f5', color: '#333', border: '1px solid #ddd',
  borderRadius: '6px', cursor: 'pointer',
};

const errorBannerStyle: React.CSSProperties = {
  padding: '0.75rem', background: '#ffebee',
  color: '#c62828', borderRadius: '8px', display: 'flex',
  justifyContent: 'space-between', alignItems: 'center',
};

const successBannerStyle: React.CSSProperties = {
  padding: '0.75rem', background: '#e8f5e9',
  color: '#2e7d32', borderRadius: '8px',
};
