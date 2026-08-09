import React, { useState } from 'react';
import type { Difficulty } from '@draw-guess/shared';
import { DIFFICULTY_LEVELS } from '@draw-guess/shared';
import { SinglePlayerGame } from './game';

interface SinglePlayerPageProps {
  onNavigateHome: () => void;
}

export const SinglePlayerPage: React.FC<SinglePlayerPageProps> = ({ onNavigateHome }) => {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);

  if (difficulty) {
    return (
      <SinglePlayerGame
        difficulty={difficulty}
        provider="minimax"
        onNavigateHome={() => setDifficulty(null)}
      />
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <h1>🎨 单机模式</h1>
      <p style={{ color: '#666', marginBottom: '0.5rem' }}>
        与 MiniMax-M3 进行 1v1 绘画对战！你画我猜，AI 画你猜，5 轮决胜负。
      </p>
      <p style={{ color: '#999', fontSize: '0.85rem', marginBottom: '2rem' }}>
        当前 AI：MiniMax-M3
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {DIFFICULTY_LEVELS.map(({ level, label, description }) => (
          <button
            key={level}
            onClick={() => setDifficulty(level)}
            style={{
              padding: '1.25rem',
              textAlign: 'left',
              background: '#fff',
              border: '2px solid #e0e0e0',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = '#2196f3';
              event.currentTarget.style.boxShadow = '0 2px 8px rgba(33,150,243,0.2)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = '#e0e0e0';
              event.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>
              {level === 'easy' ? '🟢' : level === 'medium' ? '🟡' : '🔴'} {label}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#999' }}>{description}</div>
          </button>
        ))}
      </div>

      <button
        onClick={onNavigateHome}
        style={{
          marginTop: '2rem',
          padding: '0.6rem 2rem',
          background: 'transparent',
          border: '1px solid #ddd',
          borderRadius: '8px',
          cursor: 'pointer',
          color: '#666',
        }}
      >
        ← 返回首页
      </button>
    </div>
  );
};
