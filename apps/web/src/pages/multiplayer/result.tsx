import React from 'react';

interface FinalScore {
  playerId: string;
  nickname: string;
  totalScore: number;
  rank: number;
}

interface RoundSummary {
  roundNumber: number;
  drawer: string;
  targetWord: string;
  correctGuessers: string[];
}

interface GameResultProps {
  finalScores: FinalScore[];
  roundsSummary: RoundSummary[];
  currentUserId: string;
  onPlayAgain?: () => void;
  onNavigateHome?: () => void;
}

export const GameResult: React.FC<GameResultProps> = ({
  finalScores,
  roundsSummary,
  currentUserId,
  onPlayAgain,
  onNavigateHome,
}) => {
  const sorted = [...finalScores].sort((a, b) => a.rank - b.rank);

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center' }}>🏆 游戏结束</h2>

      {/* 最终排名 */}
      <div style={{ marginBottom: '2rem' }}>
        <h3>最终排名</h3>
        {sorted.map((ps) => (
          <div
            key={ps.playerId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.75rem',
              marginBottom: '0.5rem',
              background: ps.rank === 1 ? '#fff8e1' : '#f5f5f5',
              borderRadius: '8px',
              border: ps.rank === 1 ? '2px solid #ffc107' : '1px solid #e0e0e0',
              transition: 'transform 0.2s',
            }}
          >
            <span>
              {ps.rank === 1 && '🥇 '}
              {ps.rank === 2 && '🥈 '}
              {ps.rank === 3 && '🥉 '}
              {ps.nickname}
              {ps.playerId === currentUserId && (
                <span style={{ color: '#2196f3', marginLeft: '0.5rem' }}>(你)</span>
              )}
            </span>
            <span style={{ fontWeight: 'bold' }}>{ps.totalScore} 分</span>
          </div>
        ))}
      </div>

      {/* 回合回顾 */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3>回合回顾</h3>
        {roundsSummary.map((r) => (
          <div
            key={r.roundNumber}
            style={{
              padding: '0.75rem',
              marginBottom: '0.5rem',
              background: '#fafafa',
              borderRadius: '6px',
              border: '1px solid #e8e8e8',
            }}
          >
            <strong>第 {r.roundNumber} 轮</strong> — {r.drawer} 画了「{r.targetWord}」
            {r.correctGuessers.length > 0 ? (
              <span style={{ color: '#4caf50' }}>
                {' '}
                ✅ {r.correctGuessers.join(', ')} 猜对了
              </span>
            ) : (
              <span style={{ color: '#f44336' }}> ❌ 无人猜对</span>
            )}
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        {onPlayAgain && (
          <button
            onClick={onPlayAgain}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            🔄 再来一局
          </button>
        )}
        {onNavigateHome && (
          <button
            onClick={onNavigateHome}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            🏠 返回首页
          </button>
        )}
      </div>
    </div>
  );
};
