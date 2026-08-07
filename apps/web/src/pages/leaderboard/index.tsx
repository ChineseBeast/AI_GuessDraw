import React from 'react';
import { useLeaderboard } from '../../hooks/useLeaderboard';

interface LeaderboardPageProps {
  currentUserId?: string;
  onNavigateHome: () => void;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ currentUserId, onNavigateHome }) => {
  const { entries, period, periods, loading, error, total, changePeriod } = useLeaderboard();

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>🏆 排行榜</h1>
        <button
          onClick={onNavigateHome}
          style={{
            padding: '0.5rem 1rem', background: 'transparent',
            border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer',
          }}
        >
          ← 返回首页
        </button>
      </div>

      {/* 周期切换 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {periods.map(({ period: p, label }) => (
          <button
            key={p}
            onClick={() => changePeriod(p)}
            style={{
              flex: 1,
              padding: '0.6rem',
              background: period === p ? '#2196f3' : '#f5f5f5',
              color: period === p ? 'white' : '#333',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: period === p ? 'bold' : 'normal',
              fontSize: '0.95rem',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 错误 */}
      {error && (
        <div style={{ padding: '0.75rem', background: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
          加载中...
        </div>
      )}

      {/* 排行榜列表 */}
      {!loading && !error && (
        <div>
          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
              <p style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📭</p>
              <p>暂无排行数据，快去玩一局吧！</p>
            </div>
          ) : (
            <div>
              {/* 前三名特殊展示 */}
              {entries.slice(0, 3).map((entry) => (
                <div
                  key={entry.playerId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    marginBottom: '0.5rem',
                    borderRadius: '12px',
                    background: entry.playerId === currentUserId ? '#e3f2fd' : '#fafafa',
                    border: entry.playerId === currentUserId ? '2px solid #2196f3' : '1px solid #e0e0e0',
                    borderLeft: `4px solid ${
                      entry.rank === 1 ? '#ffc107' : entry.rank === 2 ? '#90a4ae' : '#cd7f32'
                    }`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>
                      {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                        {entry.nickname}
                        {entry.playerId === currentUserId && ' (你)'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#999' }}>
                        {entry.gamesPlayed} 场游戏 · {entry.winCount} 胜
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#2196f3' }}>
                    {entry.totalScore}
                  </div>
                </div>
              ))}

              {/* 其余排名 */}
              {entries.slice(3).map((entry) => (
                <div
                  key={entry.playerId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.6rem 1rem',
                    marginBottom: '0.3rem',
                    borderRadius: '8px',
                    background: entry.playerId === currentUserId ? '#e3f2fd' : 'transparent',
                    border: entry.playerId === currentUserId ? '1px solid #2196f3' : '1px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ width: '2rem', textAlign: 'center', color: '#999', fontWeight: 'bold' }}>
                      {entry.rank}
                    </span>
                    <div>
                      <span style={{ fontWeight: entry.playerId === currentUserId ? 'bold' : 'normal' }}>
                        {entry.nickname}
                        {entry.playerId === currentUserId && ' (你)'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#999', marginLeft: '0.5rem' }}>
                        {entry.gamesPlayed}场 · {entry.winCount}胜
                      </span>
                    </div>
                  </div>
                  <span style={{ fontWeight: 'bold', color: '#2196f3' }}>{entry.totalScore}</span>
                </div>
              ))}

              <div style={{ textAlign: 'center', color: '#999', fontSize: '0.85rem', marginTop: '1rem' }}>
                共 {total} 名玩家
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
