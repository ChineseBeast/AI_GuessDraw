import React from 'react';
import { TIMER_WARNING_THRESHOLD } from '@draw-guess/shared';

interface TimerProps {
  timeRemaining: number;
  totalTime?: number;
}

export const Timer: React.FC<TimerProps> = ({ timeRemaining, totalTime = 60 }) => {
  const isWarning = timeRemaining <= TIMER_WARNING_THRESHOLD;
  const progress = timeRemaining / totalTime;

  return (
    <div style={{ textAlign: 'center' }}>
      {/* 进度条 */}
      <div
        style={{
          width: '100%',
          height: '6px',
          background: '#e0e0e0',
          borderRadius: '3px',
          overflow: 'hidden',
          marginBottom: '0.5rem',
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: isWarning ? '#f44336' : '#4caf50',
            borderRadius: '3px',
            transition: 'width 1s linear',
          }}
        />
      </div>

      {/* 数字 */}
      <span
        style={{
          fontSize: isWarning ? '2.5rem' : '2rem',
          fontWeight: 'bold',
          color: isWarning ? '#f44336' : '#333',
          transition: 'color 0.3s ease',
          animation: isWarning ? 'pulse 0.5s ease-in-out infinite alternate' : 'none',
        }}
      >
        {timeRemaining}s
      </span>

      {/* 脉冲动画 keyframes */}
      <style>{`
        @keyframes pulse {
          from { transform: scale(1); }
          to { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
};
