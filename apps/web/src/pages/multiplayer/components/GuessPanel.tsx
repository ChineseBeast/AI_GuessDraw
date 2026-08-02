import React, { useState, useCallback } from 'react';
import type { GuessResultEvent, CorrectGuessEvent } from '@draw-guess/shared';

interface GuessPanelProps {
  isDrawer: boolean;
  isSpectator: boolean;
  guessResult: GuessResultEvent | null;
  correctGuesses: CorrectGuessEvent[];
  onSubmitGuess: (text: string) => void;
  disabled?: boolean;
}

export const GuessPanel: React.FC<GuessPanelProps> = ({
  isDrawer,
  isSpectator,
  guessResult,
  correctGuesses,
  onSubmitGuess,
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const hasGuessedCorrectly = guessResult?.isCorrect ?? false;

  const handleSubmit = useCallback(() => {
    if (text.trim() && !hasGuessedCorrectly && !disabled) {
      onSubmitGuess(text.trim());
      setText('');
    }
  }, [text, hasGuessedCorrectly, disabled, onSubmitGuess]);

  // 绘画者或观众不显示猜词面板
  if (isDrawer || isSpectator) {
    return null;
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* 已猜对列表 */}
      {correctGuesses.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>
            ✅ 已猜对 ({correctGuesses.length})
          </div>
          {correctGuesses.map((cg, i) => (
            <div
              key={i}
              style={{
                padding: '0.2rem 0',
                fontSize: '0.85rem',
                color: '#4caf50',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>
                {cg.rank === 1 ? '🥇' : cg.rank === 2 ? '🥈' : cg.rank === 3 ? '🥉' : '⭐'}{' '}
                {cg.nickname}
              </span>
              <span>+{cg.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* 猜词输入 */}
      {!hasGuessedCorrectly ? (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              placeholder="输入你的猜测..."
              disabled={disabled}
              style={{
                flex: 1,
                padding: '0.6rem',
                borderRadius: '6px',
                border: '1px solid #ccc',
                fontSize: '1rem',
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || disabled}
              style={{
                padding: '0.6rem 1.2rem',
                background: !text.trim() || disabled ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: !text.trim() || disabled ? 'default' : 'pointer',
                fontWeight: 'bold',
              }}
            >
              猜！
            </button>
          </div>

          {/* 反馈 */}
          {guessResult && !guessResult.isCorrect && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
                background: '#fff3e0',
              }}
            >
              {guessResult.proximity === 'close' && '🤏 很接近了！'}
              {guessResult.proximity === 'length_match' && '📏 字数对了，但内容不对'}
              {guessResult.proximity === 'wrong' && '❌ 不对，再试试！'}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: '0.75rem',
            background: '#e8f5e9',
            borderRadius: '8px',
            color: '#2e7d32',
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          🎉 恭喜！你猜对了！(+{guessResult?.score ?? '?'}分)
        </div>
      )}
    </div>
  );
};
