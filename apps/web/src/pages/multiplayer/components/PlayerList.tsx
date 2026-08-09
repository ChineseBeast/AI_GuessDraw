import React from 'react';
import type { WSPlayerInfo } from '@draw-guess/shared';

interface PlayerListProps {
  players: WSPlayerInfo[];
  currentUserId?: string;
  hostId?: string;
}

export const PlayerList: React.FC<PlayerListProps> = ({ players, currentUserId, hostId }) => {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.4rem' }}>
        👥 玩家 ({players.length})
      </div>
      {sorted.map((player) => (
        <div
          key={player.userId}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.4rem 0.5rem',
            marginBottom: '0.2rem',
            borderRadius: '6px',
            background: player.userId === currentUserId ? '#e3f2fd' : 'transparent',
            fontWeight: player.userId === currentUserId ? 'bold' : 'normal',
            opacity: player.connectionStatus === 'disconnected' ? 0.5 : 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {/* 角色图标 */}
            <span style={{ fontSize: '0.9rem' }}>
              {player.isAI ? '🤖' : player.role === 'drawer' ? '🎨' : player.role === 'spectator' ? '👀' : '🔍'}
            </span>

            {/* 昵称 */}
            <span>
              {player.nickname}
              {player.isAI && (
                <span style={{ fontSize: '0.7rem', background: '#ede7f6', color: '#5e35b1', borderRadius: '4px', padding: '0 0.3rem', marginLeft: '0.2rem' }}>
                  AI
                </span>
              )}
              {player.userId === hostId && ' 👑'}
              {player.userId === currentUserId && ' (你)'}
            </span>

            {/* 连接状态 */}
            {player.connectionStatus === 'disconnected' && (
              <span style={{ fontSize: '0.7rem', color: '#f44336' }}>已断开</span>
            )}
          </div>

          {/* 分数 */}
          <span style={{ fontWeight: 'bold', color: '#2196f3' }}>{player.score}</span>
        </div>
      ))}

      {players.length === 0 && (
        <div style={{ color: '#999', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
          暂无玩家
        </div>
      )}
    </div>
  );
};
