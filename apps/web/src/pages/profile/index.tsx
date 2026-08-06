import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface ProfilePageProps {
  onNavigateHome: () => void;
  onNavigateSettings: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigateHome, onNavigateSettings }) => {
  const { user, updateProfile, loading, error, clearError } = useAuth();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');

  if (!user) {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <p>请先登录</p>
        <button onClick={onNavigateHome} style={buttonStyle}>返回首页</button>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      await updateProfile({
        username: username.trim() !== user.username ? username.trim() : undefined,
        email: email !== (user.email || '') ? email : undefined,
      });
      setEditing(false);
    } catch {
      // error handled by useAuth
    }
  };

  const handleCancel = () => {
    setUsername(user.username);
    setEmail(user.email || '');
    setEditing(false);
    clearError();
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>👤 个人资料</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onNavigateSettings} style={secondaryButtonStyle}>⚙️ 设置</button>
          <button onClick={onNavigateHome} style={secondaryButtonStyle}>← 返回</button>
        </div>
      </div>

      {error && (
        <div style={{ ...errorBannerStyle, marginBottom: '1rem' }}>
          <span>{error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828' }}>✕</button>
        </div>
      )}

      {/* 用户头像和基本信息 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem', padding: '2rem', background: '#f5f5f5', borderRadius: '12px' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem',
        }}>
          {user.username.charAt(0).toUpperCase()}
        </div>
        <h2 style={{ margin: 0 }}>{user.username}</h2>
        {user.email && <p style={{ color: '#666', margin: '0.5rem 0 0' }}>{user.email}</p>}
      </div>

      {/* 游戏统计 */}
      {user.stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          <StatCard label="总场次" value={user.stats.gamesPlayed} />
          <StatCard label="胜场" value={user.stats.gamesWon} />
          <StatCard label="总得分" value={user.stats.totalScore} />
          <StatCard label="连胜" value={user.stats.currentStreak} />
        </div>
      )}

      {/* 资料编辑 */}
      {editing ? (
        <div style={{ padding: '1.5rem', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0 }}>编辑资料</h3>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold' }}>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="2-20 个字符"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold' }}>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="选填"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleSave}
              disabled={loading}
              style={{ ...primaryButtonStyle, flex: 1 }}
            >
              {loading ? '保存中...' : '保存修改'}
            </button>
            <button onClick={handleCancel} style={secondaryButtonStyle}>取消</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{ ...primaryButtonStyle, width: '100%' }}
        >
          编辑资料
        </button>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div style={{
    textAlign: 'center', padding: '1rem', background: '#f5f5f5',
    borderRadius: '8px',
  }}>
    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#667eea' }}>{value}</div>
    <div style={{ fontSize: '0.8rem', color: '#666' }}>{label}</div>
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem', fontSize: '1rem',
  borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', fontSize: '0.9rem',
  background: '#2196f3', color: 'white', border: 'none', borderRadius: '6px',
  cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '0.75rem 1.5rem', fontSize: '1rem',
  background: '#2196f3', color: 'white', border: 'none', borderRadius: '8px',
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
