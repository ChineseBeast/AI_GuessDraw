import React from 'react';

interface ScoreBoardProps {
  userScore: number;
  aiScore: number;
  currentRound: number;
  totalRounds: number;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  userScore,
  aiScore,
  currentRound,
  totalRounds,
}) => {
  return (
    <div
      style={{
        padding: '0.75rem',
        background: '#f5f5f5',
        borderRadius: '8px',
      }}
    >
      <div
        style={{
          fontSize: '0.8rem',
          color: '#999',
          marginBottom: '0.5rem',
          textAlign: 'center',
        }}
      >
        第 {currentRound}/{totalRounds} 轮
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        {/* 用户 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>你</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2196f3' }}>
            {userScore}
          </div>
        </div>

        {/* VS */}
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ccc' }}>VS</div>

        {/* AI */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>AI</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f44336' }}>
            {aiScore}
          </div>
        </div>
      </div>
    </div>
  );
};
