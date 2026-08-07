import React, { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useRoom } from '../../hooks/useRoom';
import type { GameStartedEvent } from '@draw-guess/shared';

interface LobbyProps {
  userId: string;
  nickname: string;
  serverUrl: string;
  onNavigateHome?: () => void;
  onGameStarted?: (gameInit: GameStartedEvent) => void;
}

export const MultiplayerLobby: React.FC<LobbyProps> = ({ userId, nickname, serverUrl, onNavigateHome, onGameStarted }) => {
  const { connected, emit, on, error: socketError } = useSocket({ serverUrl, userId, nickname });
  const { room, error, createRoom, joinRoom, clearError } = useRoom({ on, emit });

  const [maxPlayers, setMaxPlayers] = useState(4);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [inviteCode, setInviteCode] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // 监听游戏开始事件
  useEffect(() => {
    const unsub = on<GameStartedEvent>('game_started', (data) => {
      onGameStarted?.(data);
    });
    return unsub;
  }, [on, onGameStarted]);

  if (!connected) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>正在连接服务器...</h2>
        <p>请稍候</p>
        {socketError && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#ffebee', color: '#c62828', borderRadius: '8px', maxWidth: '400px', margin: '1rem auto' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>❌ 连接失败</p>
            <p style={{ fontSize: '0.9rem', wordBreak: 'break-all' }}>{socketError}</p>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: '0.75rem', padding: '0.5rem 1.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              刷新重试
            </button>
          </div>
        )}
      </div>
    );
  }

  // 如果已进入房间，显示房间信息
  if (room) {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
        <h2>🏠 房间大厅</h2>
        <div style={{ background: '#f0f4ff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <p><strong>邀请码：</strong><span style={{ fontSize: '2rem', letterSpacing: '0.3rem', fontFamily: 'monospace' }}>{room.inviteCode}</span></p>
          <p>把邀请码分享给朋友，让他们加入你的房间！</p>
        </div>

        <h3>玩家列表 ({room.players.length}/{room.maxPlayers})</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {room.players.map((p) => (
            <li
              key={p.userId}
              style={{
                padding: '0.75rem',
                marginBottom: '0.5rem',
                background: p.connectionStatus === 'disconnected' ? '#ffe0e0' : '#e8f5e9',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>
                {p.userId === room.hostId ? '👑 ' : '🎮 '}
                {p.nickname}
                {p.connectionStatus === 'disconnected' && ' (断线中...)'}
              </span>
              <span style={{ color: '#666', fontSize: '0.85rem' }}>
                {p.role === 'spectator' ? '👀 观众' : `得分: ${p.score}`}
              </span>
            </li>
          ))}
        </ul>

        {room.status === 'waiting' && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => {
                emit('start_game');
              }}
              style={{
                padding: '0.75rem 2rem',
                fontSize: '1.1rem',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
              disabled={room.players.length < 2}
            >
              🚀 开始游戏 ({room.players.length}人)
            </button>
            <button
              onClick={() => emit('leave_room')}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              离开房间
            </button>
          </div>
        )}

        {room.status === 'playing' && (
          <p style={{ color: '#ff9800', fontWeight: 'bold' }}>🎮 游戏进行中...</p>
        )}
      </div>
    );
  }

  // 未加入房间：显示创建/加入界面
  return (
    <div style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center' }}>🎨 你画我猜 - 联机模式</h1>

      {error && (
        <div style={{ background: '#ffebee', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', color: '#c62828' }}>
          ❌ {error}
          <button onClick={clearError} style={{ marginLeft: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>✕</button>
        </div>
      )}

      {!showCreate ? (
        <div>
          {/* 加入房间 */}
          <div style={{ marginBottom: '2rem' }}>
            <h3>🔑 加入房间</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="输入 6 位邀请码"
                maxLength={6}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '1.2rem',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  textTransform: 'uppercase',
                  letterSpacing: '0.2rem',
                }}
              />
              <button
                onClick={() => {
                  if (inviteCode.length === 6) {
                    joinRoom(inviteCode);
                  }
                }}
                disabled={inviteCode.length !== 6}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  background: inviteCode.length === 6 ? '#2196f3' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: inviteCode.length === 6 ? 'pointer' : 'not-allowed',
                }}
              >
                加入
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'center', color: '#999', margin: '1.5rem 0' }}>—— 或者 ——</div>

          {/* 创建房间按钮 */}
          <button
            onClick={() => setShowCreate(true)}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.2rem',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            ✨ 创建新房间
          </button>
        </div>
      ) : (
        <div>
          {/* 创建房间表单 */}
          <h3>✨ 创建房间</h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>最大人数</label>
            <select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                borderRadius: '6px',
                border: '1px solid #ccc',
              }}
            >
              {[4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n} 人</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>难度</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: difficulty === d ? '#2196f3' : '#e0e0e0',
                    color: difficulty === d ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: difficulty === d ? 'bold' : 'normal',
                  }}
                >
                  {{ easy: '🟢 简单', medium: '🟡 中等', hard: '🔴 困难' }[d]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => {
                createRoom(maxPlayers, difficulty);
              }}
              style={{
                flex: 1,
                padding: '0.75rem',
                fontSize: '1.1rem',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              🎮 创建并进入
            </button>
            <button
              onClick={() => setShowCreate(false)}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#f5f5f5',
                border: '1px solid #ccc',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              返回
            </button>
          </div>
        </div>
      )}

      {onNavigateHome && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={onNavigateHome}
            style={{
              padding: '0.5rem 1.5rem', background: 'transparent',
              border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', color: '#666',
            }}
          >
            ← 返回首页
          </button>
        </div>
      )}
    </div>
  );
};
