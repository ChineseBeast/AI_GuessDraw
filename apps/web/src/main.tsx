import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { SinglePlayerPage } from './pages/singleplayer';
import { MultiplayerLobby } from './pages/multiplayer/lobby';
import { MultiplayerGame } from './pages/multiplayer/game';
import { LeaderboardPage } from './pages/leaderboard';
import { LoginPage, RegisterPage } from './pages/auth';
import { ProfilePage, SettingsPage } from './pages/user';
import { AdminPage } from './pages/admin';
import { StoryPage } from './pages/story';
import { AuthProvider, useAuth, type User } from './hooks/useAuth';
import type { GameStartedEvent, WSPlayerInfo } from '@draw-guess/shared';

/** 游客身份（localStorage 持久化：游客登录一次后免重复拦截） */
const GUEST_STORAGE_KEY = 'draw_guess_guest';

interface GuestIdentity {
  id: string;
  nickname: string;
}

function loadGuest(): GuestIdentity | null {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GuestIdentity) : null;
  } catch {
    return null;
  }
}

function saveGuest(guest: GuestIdentity): void {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest));
}

function clearGuest(): void {
  localStorage.removeItem(GUEST_STORAGE_KEY);
}

type Page =
  | 'home'
  | 'login'
  | 'register'
  | 'profile'
  | 'settings'
  | 'admin'
  | 'story'
  | 'singleplayer'
  | 'multiplayer-lobby'
  | 'multiplayer-game'
  | 'leaderboard';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('home');
  const { user, isAuthenticated, logout, initializing } = useAuth();
  // 游客身份（游客登录后持久化，刷新不丢）
  const [guest, setGuest] = useState<GuestIdentity | null>(() => loadGuest());
  // 拦截后待进入的目标页面（登录/游客登录成功后跳转）
  const [pendingMode, setPendingMode] = useState<Page | null>(null);

  const [multiplayerConfig, setMultiplayerConfig] = useState<{
    userId: string;
    nickname: string;
    serverUrl: string;
    gameInit?: GameStartedEvent;
    players?: WSPlayerInfo[];
    hostId?: string;
  } | null>(null);

  // 初始化加载中（正在验证 token）显示占位
  if (initializing) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>⏳ 加载中...</div>
        <div style={{ fontSize: '0.9rem' }}>正在验证会话</div>
      </div>
    );
  }

  // 用户标识：已登录用真实 ID，游客用持久化的游客 ID
  const hasIdentity = isAuthenticated || !!guest;
  const currentUserId = user?.id ?? guest?.id ?? `guest_${Math.random().toString(36).slice(2, 10)}`;

  const handleNavigateHome = () => setPage('home');

  // 登录/注册成功：进入拦截时记录的待进入页面（无则回首页）
  const handleAuthSuccess = (loggedInUser?: User) => {
    const target = pendingMode ?? 'home';
    setPendingMode(null);
    // 登录后进入联机：用真实账号身份构建房间配置（登录成功瞬间 user state 可能未刷新，用返回值）
    if (target === 'multiplayer-lobby') {
      const u = loggedInUser ?? user;
      if (u) {
        setMultiplayerConfig({ userId: u.id, nickname: u.username, serverUrl: 'http://localhost:3000' });
      }
    }
    setPage(target);
  };

  // 游客登录：生成并持久化游客身份，再进入待进入页面；联机不允许游客（UI 已隐藏入口，此处兜底）
  const handleGuestLogin = () => {
    if (pendingMode === 'multiplayer-lobby') {
      setPendingMode(null);
      setPage('home');
      return;
    }
    if (!guest) {
      const newGuest: GuestIdentity = {
        id: `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
        nickname: `游客${Math.floor(Math.random() * 9000 + 1000)}`,
      };
      saveGuest(newGuest);
      setGuest(newGuest);
    }
    handleAuthSuccess();
  };

  // 退出游客身份
  const handleGuestLogout = () => {
    clearGuest();
    setGuest(null);
  };

  // 联机模式必须登录账号（游客不可进入）：未登录先跳登录页，登录成功后再进入
  const handleStartMultiplayer = () => {
    if (!isAuthenticated || !user) {
      setPendingMode('multiplayer-lobby');
      setPage('login');
      return;
    }
    const serverUrl = 'http://localhost:3000';
    setMultiplayerConfig({ userId: user.id, nickname: user.username, serverUrl });
    setPage('multiplayer-lobby');
  };

  const handleBackToLobby = () => setPage('multiplayer-lobby');

  const handleLogout = () => {
    logout();
    handleGuestLogout();
    setPage('home');
  };

  // ─── 首页 ────────────────────────────────────
  if (page === 'home') {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        {/* 用户信息栏 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginBottom: '1rem',
            gap: '0.75rem',
          }}
        >
          {isAuthenticated ? (
            <>
              <button
                onClick={() => setPage('profile')}
                style={{
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.9rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                👤 {user?.username}
              </button>
              {user?.role === 'admin' && (
                <button
                  onClick={() => setPage('admin')}
                  style={{
                    padding: '0.3rem 0.8rem',
                    fontSize: '0.9rem',
                    background: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  🔧 管理后台
                </button>
              )}
              <button
                onClick={() => setPage('settings')}
                style={{
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.9rem',
                  background: 'transparent',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#666',
                }}
              >
                ⚙️ 设置
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.85rem',
                  background: 'transparent',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#999',
                }}
              >
                退出
              </button>
            </>
          ) : guest ? (
            <>
              <span style={{ padding: '0.3rem 0.8rem', fontSize: '0.9rem', color: '#666' }}>
                👤 {guest.nickname}
              </span>
              <button
                onClick={handleGuestLogout}
                style={{
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.85rem',
                  background: 'transparent',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#999',
                }}
              >
                退出游客
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setPage('login')}
                style={{
                  padding: '0.4rem 1rem',
                  fontSize: '0.9rem',
                  background: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                登录
              </button>
              <button
                onClick={() => setPage('register')}
                style={{
                  padding: '0.4rem 1rem',
                  fontSize: '0.9rem',
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                注册
              </button>
            </>
          )}
        </div>

        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎨 你画我猜 AI</h1>
        <p style={{ color: '#666', marginBottom: '2rem' }}>AI 驱动的你画我猜游戏 — 支持单机、联机、故事三种模式</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={() => {
              // 未登录拦截：先登录或游客登录，再进入单机模式
              if (hasIdentity) {
                setPage('singleplayer');
              } else {
                setPendingMode('singleplayer');
                setPage('login');
              }
            }}
            style={modeButtonStyle('#667eea', '#764ba2')}
          >
            🤖 单机模式 — 与 AI 1v1 对战
          </button>

          <button onClick={handleStartMultiplayer} style={modeButtonStyle('#f093fb', '#f5576c')}>
            🌐 联机模式 — 与好友实时对战
            {!isAuthenticated && (
              <div style={{ fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.9, marginTop: '0.25rem' }}>
                🔒 需登录账号
              </div>
            )}
          </button>

          <button onClick={() => setPage('leaderboard')} style={modeButtonStyle('#ffd54f', '#ff8f00')}>
            🏆 排行榜 — 查看玩家排名
          </button>

          <button onClick={() => setPage('story')} style={modeButtonStyle('#0ea5e9', '#14b8a6')}>
            📖 故事模式 — AI 叙事绘画冒险
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
    // 联机模式必须账号登录：隐藏游客入口并提示
    const requiresAccount = pendingMode === 'multiplayer-lobby';
    return (
      <LoginPage
        onLoginSuccess={handleAuthSuccess}
        onNavigateToRegister={() => setPage('register')}
        onSkip={requiresAccount ? undefined : handleGuestLogin}
        notice={requiresAccount ? '🔒 联机模式需要登录账号后才能进入，游客暂不支持' : undefined}
      />
    );
  }

  // ─── 注册页 ──────────────────────────────────
  if (page === 'register') {
    return <RegisterPage onRegisterSuccess={handleAuthSuccess} onNavigateToLogin={() => setPage('login')} />;
  }

  // ─── 用户资料页 ──────────────────────────────
  if (page === 'profile') {
    return <ProfilePage onNavigateHome={handleNavigateHome} onNavigateSettings={() => setPage('settings')} />;
  }

  // ─── 设置页 ──────────────────────────────────
  if (page === 'settings') {
    return <SettingsPage onNavigateHome={handleNavigateHome} onNavigateProfile={() => setPage('profile')} />;
  }

  // ─── 后台管理 ────────────────────────────────
  if (page === 'admin') {
    return <AdminPage onNavigateHome={handleNavigateHome} />;
  }

  if (page === 'story') {
    return <StoryPage onNavigateHome={handleNavigateHome} />;
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
        onGameStarted={(gameInit: GameStartedEvent, players: WSPlayerInfo[], hostId: string) => {
          setMultiplayerConfig(prev => prev ? { ...prev, gameInit, players, hostId } : prev);
          setPage('multiplayer-game');
        }}
      />
    );
  }

  if (page === 'multiplayer-game' && multiplayerConfig) {
    return (
      <MultiplayerGame
        userId={multiplayerConfig.userId}
        nickname={multiplayerConfig.nickname}
        serverUrl={multiplayerConfig.serverUrl}
        gameInit={multiplayerConfig.gameInit}
        players={multiplayerConfig.players}
        hostId={multiplayerConfig.hostId}
        onBackToLobby={handleBackToLobby}
        onNavigateHome={handleNavigateHome}
      />
    );
  }

  return null;
};

function modeButtonStyle(color1: string, color2: string): React.CSSProperties {
  return {
    padding: '1.5rem',
    fontSize: '1.2rem',
    background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`,
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'transform 0.15s ease',
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
