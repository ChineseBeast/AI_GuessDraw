import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { SinglePlayerPage } from './pages/singleplayer';
import { MultiplayerLobby } from './pages/multiplayer/lobby';
import { MultiplayerGame } from './pages/multiplayer/game';
import { LeaderboardPage } from './pages/leaderboard';
import { LoginPage, RegisterPage } from './pages/auth';
import { useAuth } from './hooks/useAuth';

type Page = 'home' | 'login' | 'register' | 'singleplayer' | 'multiplayer-lobby' | 'multiplayer-game' | 'leaderboard';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('home');
  const { user, isAuthenticated, logout } = useAuth();

  const [multiplayerConfig, setMultiplayerConfig] = useState<{
    userId: string;
    nickname: string;
    serverUrl: string;
  } | null>(null);

  // 用户标识：已登录用真实 ID，游客用临时 ID
  const currentUserId = user?.id ?? `guest_${Math.random().toString(36).slice(2, 10)}`;
  const currentNickname = user?.username ?? `游客${Math.floor(Math.random() * 9000 + 1000)}`;

  const handleNavigateHome = () => setPage('home');

  const handleStartMultiplayer = () => {
    const serverUrl = 'http://localhost:3000';
    setMultiplayerConfig({ userId: currentUserId, nickname: currentNickname, serverUrl });
    setPage('multiplayer-lobby');
  };

  const handleBackToLobby = () => setPage('multiplayer-lobby');

  // ─── 首页 ────────────────────────────────────
  if (page === 'home') {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        {/* 用户信息栏 */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          marginBottom: '1rem', gap: '0.75rem',
        }}>
          {isAuthenticated ? (
            <>
              <span style={{ color: '#666', fontSize: '0.9rem' }}>
                👤 {user?.username}
              </span>
              <button
                onClick={logout}
                style={{
                  padding: '0.3rem 0.8rem', fontSize: '0.85rem',
                  background: 'transparent', border: '1px solid #ddd',
                  borderRadius: '4px', cursor: 'pointer', color: '#999',
                }}
              >
                退出
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setPage('login')}
                style={{
                  padding: '0.4rem 1rem', fontSize: '0.9rem',
                  background: '#2196f3', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                登录
              </button>
              <button
                onClick={() => setPage('register')}
                style={{
                  padding: '0.4rem 1rem', fontSize: '0.9rem',
                  background: '#4caf50', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                注册
              </button>
            </>
          )}
        </div>

        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎨 你画我猜 AI</h1>
        <p style={{ color: '#666', marginBottom: '2rem' }}>
          AI 驱动的你画我猜游戏 — 支持单机、联机、故事三种模式
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button onClick={() => setPage('singleplayer')} style={modeButtonStyle('#667eea', '#764ba2')}>
            🤖 单机模式 — 与 AI 1v1 对战
          </button>

          <button onClick={handleStartMultiplayer} style={modeButtonStyle('#f093fb', '#f5576c')}>
            🌐 联机模式 — 与好友实时对战
          </button>

          <button onClick={() => setPage('leaderboard')} style={modeButtonStyle('#ffd54f', '#ff8f00')}>
            🏆 排行榜 — 查看玩家排名
          </button>

          <button disabled style={{ ...modeButtonStyle('#a8edea', '#fed6e3'), opacity: 0.6, cursor: 'default' }}>
            📖 故事模式 — AI 叙事绘画冒险（即将推出）
          </button>
        </div>

        <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#ccc' }}>
          Draw &amp; Guess AI v0.3.0 — 用户系统 + 认证
        </p>
      </div>
    );
  }

  // ─── 登录页 ──────────────────────────────────
  if (page === 'login') {
    return (
      <LoginPage
        onLoginSuccess={handleNavigateHome}
        onNavigateToRegister={() => setPage('register')}
        onSkip={handleNavigateHome}
      />
    );
  }

  // ─── 注册页 ──────────────────────────────────
  if (page === 'register') {
    return (
      <RegisterPage
        onRegisterSuccess={handleNavigateHome}
        onNavigateToLogin={() => setPage('login')}
      />
    );
  }

  // ─── 单机模式 ────────────────────────────────
  if (page === 'singleplayer') {
    return <SinglePlayerPage onNavigateHome={handleNavigateHome} />;
  }

  // ─── 排行榜 ──────────────────────────────────
  if (page === 'leaderboard') {
    return <LeaderboardPage currentUserId={currentUserId} onNavigateHome={handleNavigateHome} />;
  }

  // ─── 联机模式 ────────────────────────────────
  if (page === 'multiplayer-lobby' && multiplayerConfig) {
    return (
      <MultiplayerLobby
        userId={multiplayerConfig.userId}
        nickname={multiplayerConfig.nickname}
        serverUrl={multiplayerConfig.serverUrl}
        onNavigateHome={handleNavigateHome}
        onGameStarted={() => setPage('multiplayer-game')}
      />
    );
  }

  if (page === 'multiplayer-game' && multiplayerConfig) {
    return (
      <MultiplayerGame
        userId={multiplayerConfig.userId}
        nickname={multiplayerConfig.nickname}
        serverUrl={multiplayerConfig.serverUrl}
        onBackToLobby={handleBackToLobby}
        onNavigateHome={handleNavigateHome}
      />
    );
  }

  return null;
};

function modeButtonStyle(color1: string, color2: string): React.CSSProperties {
  return {
    padding: '1.5rem', fontSize: '1.2rem',
    background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`,
    color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer',
    fontWeight: 'bold', transition: 'transform 0.15s ease',
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
