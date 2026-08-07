import React, { useState, useEffect, useCallback } from 'react';
import { AdminService } from '../../services/admin.service';

interface DashboardStats {
  users: { total: number; admins: number; newToday: number };
  rooms: { active: number; playing: number; waiting: number };
  games: { totalPlayed: number; totalWins: number };
  leaderboard: { weeklyCount: number; monthlyCount: number; allTimeCount: number };
}

interface AdminUser {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  stats: { gamesPlayed: number; gamesWon: number; totalScore: number; currentStreak: number };
}

interface AdminRoom {
  id: string;
  inviteCode: string;
  hostId: string;
  status: string;
  maxPlayers: number;
  difficulty: string;
  createdAt: string;
  playerCount: number;
  spectatorCount: number;
}

type Tab = 'dashboard' | 'users' | 'rooms' | 'words';

export const AdminPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [words, setWords] = useState<{ easy: string[]; medium: string[]; hard: string[] }>({
    easy: [],
    medium: [],
    hard: [],
  });
  const [error, setError] = useState<string | null>(null);
  // 词库内联添加表单: { [difficulty]: { input, visible } }
  const [wordInput, setWordInput] = useState<{ easy: string; medium: string; hard: string }>({
    easy: '',
    medium: '',
    hard: '',
  });
  // 正在重置密码的用户 id 与新密码
  const [resetPwd, setResetPwd] = useState<{ userId: string; password: string } | null>(null);
  // 待二次确认删除的用户/房间 id
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);
  const [confirmCloseRoom, setConfirmCloseRoom] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const d = await AdminService.getDashboard();
      setStats(d.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const d = await AdminService.getUsers();
      setUsers(d.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const d = await AdminService.getRooms();
      setRooms(d.rooms);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  const loadWords = useCallback(async () => {
    try {
      const d = await AdminService.getWords();
      setWords(d.words);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    setError(null);
    if (tab === 'dashboard') loadDashboard();
    else if (tab === 'users') loadUsers();
    else if (tab === 'rooms') loadRooms();
    else if (tab === 'words') loadWords();
  }, [tab, loadDashboard, loadUsers, loadRooms, loadWords]);

  // ─── 用户操作 ──────────────────────────────
  const handleDeleteUser = async (userId: string) => {
    try {
      await AdminService.deleteUser(userId);
      setConfirmDeleteUser(null);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwd) return;
    if (resetPwd.password.length < 6) {
      setError('新密码至少 6 位');
      return;
    }
    try {
      await AdminService.resetPassword(resetPwd.userId, resetPwd.password);
      setResetPwd(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '重置失败');
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await AdminService.setUserRole(userId, newRole);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : '修改角色失败');
    }
  };

  // ─── 房间操作 ──────────────────────────────
  const handleCloseRoom = async (roomId: string) => {
    try {
      await AdminService.closeRoom(roomId);
      setConfirmCloseRoom(null);
      await loadRooms();
    } catch (e) {
      setError(e instanceof Error ? e.message : '关闭失败');
    }
  };

  // ─── 词库操作 ─────────────────────────────
  const handleAddWord = async (difficulty: 'easy' | 'medium' | 'hard') => {
    const word = wordInput[difficulty].trim();
    if (!word) return;
    try {
      const d = await AdminService.addWord(difficulty, word);
      setWords(d.words);
      setWordInput({ ...wordInput, [difficulty]: '' });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败');
    }
  };

  const handleRemoveWord = async (difficulty: string, word: string) => {
    try {
      await AdminService.removeWord(difficulty, word);
      const d = await AdminService.getWords();
      setWords(d.words);
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: '8px',
    padding: '1.2rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    textAlign: 'center',
  };

  const statNumberStyle: React.CSSProperties = { fontSize: '2rem', fontWeight: 'bold', color: '#667eea' };
  const labelStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#888', marginTop: '0.3rem' };

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.6rem 1.2rem',
    fontSize: '0.95rem',
    border: 'none',
    cursor: 'pointer',
    background: active ? '#667eea' : 'transparent',
    color: active ? 'white' : '#666',
    borderRadius: '6px',
    fontWeight: active ? 'bold' : 'normal',
  });

  const tableThStyle: React.CSSProperties = {
    padding: '0.6rem',
    textAlign: 'left',
    borderBottom: '2px solid #eee',
    fontSize: '0.85rem',
    color: '#888',
  };
  const tableTdStyle: React.CSSProperties = {
    padding: '0.6rem',
    borderBottom: '1px solid #f0f0f0',
    fontSize: '0.9rem',
  };
  const btnStyle: React.CSSProperties = {
    padding: '0.3rem 0.6rem',
    fontSize: '0.8rem',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    margin: '0 0.2rem',
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>🔧 后台管理</h1>
        <button onClick={onNavigateHome} style={{ ...btnStyle, background: '#f0f0f0', color: '#666' }}>
          ← 返回首页
        </button>
      </div>

      {/* Tab 导航 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button style={tabButtonStyle(tab === 'dashboard')} onClick={() => setTab('dashboard')}>
          📊 仪表盘
        </button>
        <button style={tabButtonStyle(tab === 'users')} onClick={() => setTab('users')}>
          👥 用户管理
        </button>
        <button style={tabButtonStyle(tab === 'rooms')} onClick={() => setTab('rooms')}>
          🏠 房间管理
        </button>
        <button style={tabButtonStyle(tab === 'words')} onClick={() => setTab('words')}>
          📖 词库管理
        </button>
      </div>

      {error && (
        <div
          style={{
            background: '#fee',
            color: '#c33',
            padding: '0.8rem',
            borderRadius: '4px',
            marginBottom: '1rem',
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      {/* ─── Dashboard ─── */}
      {tab === 'dashboard' && stats && (
        <div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#333' }}>系统概览</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={cardStyle}>
              <div style={statNumberStyle}>{stats.users.total}</div>
              <div style={labelStyle}>总用户</div>
            </div>
            <div style={cardStyle}>
              <div style={statNumberStyle}>{stats.users.admins}</div>
              <div style={labelStyle}>管理员</div>
            </div>
            <div style={cardStyle}>
              <div style={statNumberStyle}>{stats.users.newToday}</div>
              <div style={labelStyle}>今日新增</div>
            </div>
            <div style={cardStyle}>
              <div style={statNumberStyle}>{stats.rooms.active}</div>
              <div style={labelStyle}>活跃房间</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div style={cardStyle}>
              <div style={statNumberStyle}>{stats.games.totalPlayed}</div>
              <div style={labelStyle}>总游戏场次</div>
            </div>
            <div style={cardStyle}>
              <div style={statNumberStyle}>{stats.games.totalWins}</div>
              <div style={labelStyle}>总胜场</div>
            </div>
            <div style={cardStyle}>
              <div style={statNumberStyle}>{stats.leaderboard.weeklyCount}</div>
              <div style={labelStyle}>周榜人数</div>
            </div>
            <div style={cardStyle}>
              <div style={statNumberStyle}>{stats.leaderboard.allTimeCount}</div>
              <div style={labelStyle}>总榜人数</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Users ─── */}
      {tab === 'users' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#333' }}>用户列表（{users.length}）</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableThStyle}>用户名</th>
                <th style={tableThStyle}>角色</th>
                <th style={tableThStyle}>游戏场次</th>
                <th style={tableThStyle}>注册时间</th>
                <th style={tableThStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={tableTdStyle}>{u.username}</td>
                  <td style={tableTdStyle}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        background: u.role === 'admin' ? '#ffd54f' : '#e0e0e0',
                        color: u.role === 'admin' ? '#e65100' : '#666',
                      }}
                    >
                      {u.role === 'admin' ? '管理员' : '用户'}
                    </span>
                  </td>
                  <td style={tableTdStyle}>{u.stats?.gamesPlayed || 0}</td>
                  <td style={tableTdStyle}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td style={tableTdStyle}>
                    <button
                      style={{ ...btnStyle, background: '#e3f2fd', color: '#1976d2' }}
                      onClick={() => handleToggleRole(u.id, u.role)}
                    >
                      {u.role === 'admin' ? '降为用户' : '升为管理员'}
                    </button>
                    <button
                      style={{ ...btnStyle, background: '#fff3e0', color: '#e65100' }}
                      onClick={() => setResetPwd({ userId: u.id, password: '' })}
                    >
                      重置密码
                    </button>
                    {confirmDeleteUser === u.id ? (
                      <>
                        <button
                          style={{ ...btnStyle, background: '#c62828', color: 'white' }}
                          onClick={() => handleDeleteUser(u.id)}
                        >
                          确认删除
                        </button>
                        <button
                          style={{ ...btnStyle, background: '#e0e0e0', color: '#666' }}
                          onClick={() => setConfirmDeleteUser(null)}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        style={{ ...btnStyle, background: '#ffebee', color: '#c62828' }}
                        onClick={() => setConfirmDeleteUser(u.id)}
                      >
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {resetPwd && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#fff8e1',
                borderRadius: '6px',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '0.9rem', color: '#333' }}>为新密码（≥6 位）：</span>
              <input
                type="text"
                value={resetPwd.password}
                onChange={(e) => setResetPwd({ ...resetPwd, password: e.target.value })}
                placeholder="新密码"
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '0.9rem',
                  minWidth: '180px',
                }}
              />
              <button style={{ ...btnStyle, background: '#1976d2', color: 'white' }} onClick={handleResetPassword}>
                确认重置
              </button>
              <button style={{ ...btnStyle, background: '#e0e0e0', color: '#666' }} onClick={() => setResetPwd(null)}>
                取消
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Rooms ─── */}
      {tab === 'rooms' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#333' }}>房间列表（{rooms.length}）</h2>
          {rooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>暂无活跃房间</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableThStyle}>邀请码</th>
                  <th style={tableThStyle}>状态</th>
                  <th style={tableThStyle}>人数</th>
                  <th style={tableThStyle}>难度</th>
                  <th style={tableThStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id}>
                    <td style={tableTdStyle}>{r.inviteCode}</td>
                    <td style={tableTdStyle}>{r.status}</td>
                    <td style={tableTdStyle}>
                      {r.playerCount}/{r.maxPlayers}
                    </td>
                    <td style={tableTdStyle}>{r.difficulty}</td>
                    <td style={tableTdStyle}>
                      {confirmCloseRoom === r.id ? (
                        <>
                          <button
                            style={{ ...btnStyle, background: '#c62828', color: 'white' }}
                            onClick={() => handleCloseRoom(r.id)}
                          >
                            确认关闭
                          </button>
                          <button
                            style={{ ...btnStyle, background: '#e0e0e0', color: '#666' }}
                            onClick={() => setConfirmCloseRoom(null)}
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <button
                          style={{ ...btnStyle, background: '#ffebee', color: '#c62828' }}
                          onClick={() => setConfirmCloseRoom(r.id)}
                        >
                          关闭
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Words ─── */}
      {tab === 'words' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#333' }}>词库管理</h2>
          {(['easy', 'medium', 'hard'] as const).map((diff) => (
            <div key={diff} style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <h3 style={{ fontSize: '0.95rem', color: '#666' }}>
                  {diff === 'easy' ? '简单' : diff === 'medium' ? '中等' : '困难'}（{words[diff].length}）
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
                <input
                  type="text"
                  value={wordInput[diff]}
                  onChange={(e) => setWordInput({ ...wordInput, [diff]: e.target.value })}
                  placeholder={`添加到${diff === 'easy' ? '简单' : diff === 'medium' ? '中等' : '困难'}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddWord(diff);
                  }}
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '0.9rem',
                    flex: 1,
                    minWidth: '200px',
                  }}
                />
                <button
                  style={{ ...btnStyle, background: '#e8f5e9', color: '#2e7d32', padding: '0.4rem 0.8rem' }}
                  onClick={() => handleAddWord(diff)}
                >
                  + 添加
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {words[diff].map((w, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      background: '#f5f5f5',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                    }}
                  >
                    {w}
                    <button
                      style={{
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: '#c62828',
                        fontSize: '0.85rem',
                      }}
                      onClick={() => handleRemoveWord(diff, w)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
