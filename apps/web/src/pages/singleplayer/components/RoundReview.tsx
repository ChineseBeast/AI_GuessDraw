import React from 'react';
import type { SinglePlayerRound } from '@draw-guess/shared';

interface RoundReviewProps {
  round: SinglePlayerRound;
  roundNumber: number;
}

export const RoundReview: React.FC<RoundReviewProps> = ({ round, roundNumber }) => {
  const isUserDraws = round.role === 'user_draws';

  return (
    <div
      style={{
        padding: '0.75rem',
        background: '#fafafa',
        borderRadius: '8px',
        marginBottom: '0.5rem',
        border: '1px solid #e0e0e0',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
        <strong>第 {roundNumber} 轮</strong>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>
          {isUserDraws ? '🎨 你画 AI 猜' : '🤖 AI 画 你猜'}
        </span>
        <span style={{ fontSize: '0.85rem', color: '#999' }}>
          词: <strong>{round.targetWord}</strong>
        </span>
      </div>

      {isUserDraws ? (
        <div style={{ fontSize: '0.85rem', color: '#666' }}>
          {round.aiGuesses && round.aiGuesses.length > 0 ? (
            <div>
              AI 猜了：
              {round.aiGuesses.map((g, i) => (
                <span
                  key={i}
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    background: g.word === round.targetWord ? '#e8f5e9' : '#fff3e0',
                    color: g.word === round.targetWord ? '#2e7d32' : '#e65100',
                  }}
                >
                  {g.word} ({Math.round(g.confidence * 100)}%)
                </span>
              ))}
            </div>
          ) : (
            <span>AI 未能识别</span>
          )}
          <span style={{ marginLeft: '0.75rem', fontWeight: 'bold', color: '#2196f3' }}>
            +{round.userRoundScore} 分
          </span>
        </div>
      ) : (
        <div style={{ fontSize: '0.85rem', color: '#666' }}>
          {round.userGuessedCorrectly ? (
            <span style={{ color: '#2e7d32' }}>✅ 猜对了！</span>
          ) : (
            <span style={{ color: '#f44336' }}>❌ 未猜对</span>
          )}
          <span style={{ marginLeft: '0.75rem', fontWeight: 'bold', color: '#2196f3' }}>
            +{round.userRoundScore} 分
          </span>
        </div>
      )}
    </div>
  );
};
