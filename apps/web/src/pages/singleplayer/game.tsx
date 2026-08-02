import React, { useRef, useEffect } from 'react';
import { Canvas, type CanvasRef } from '@draw-guess/ui';
import type { ToolState } from '@draw-guess/ui';
import { DEFAULT_TOOL_STATE } from '@draw-guess/ui';
import { useSinglePlayer } from '../../hooks/useSinglePlayer';
import { useAuth } from '../../hooks/useAuth';
import { LeaderboardService } from '../../services/leaderboard.service';
import { Toolbar } from './components/Toolbar';
import { Timer } from './components/Timer';
import { ScoreBoard } from './components/ScoreBoard';

interface SinglePlayerGameProps {
  difficulty: 'easy' | 'medium' | 'hard';
  onNavigateHome: () => void;
}

export const SinglePlayerGame: React.FC<SinglePlayerGameProps> = ({ difficulty, onNavigateHome }) => {
  const {
    state,
    canvasRef: hookCanvasRef,
    currentRound,
    isUserDrawing,
    isGameOver,
    startGame,
    submitDrawing,
    submitGuess,
    nextRound,
    resetGame,
    setGuessText,
    clearError,
  } = useSinglePlayer();

  const { user, isAuthenticated } = useAuth();
  const localCanvasRef = useRef<CanvasRef>(null);
  const [toolState, setToolState] = React.useState<ToolState>(DEFAULT_TOOL_STATE);
  const [showEmptyWarning, setShowEmptyWarning] = React.useState(false);
  const scoreSubmittedRef = useRef(false);

  // 自动提交分数到排行榜
  useEffect(() => {
    if (isGameOver && state.game && isAuthenticated && !scoreSubmittedRef.current) {
      scoreSubmittedRef.current = true;
      LeaderboardService.submitResult({
        playerId: user!.id,
        nickname: user!.username,
        score: state.game.userScore,
        won: state.game.userScore > state.game.aiScore,
      }).catch(() => {
        // 静默失败，不影响游戏体验
      });
    }
    if (!isGameOver) {
      scoreSubmittedRef.current = false;
    }
  }, [isGameOver, state.game, isAuthenticated, user]);

  // 连接 canvas ref
  useEffect(() => {
    hookCanvasRef.current = {
      getImageDataURL: () => localCanvasRef.current?.getImageDataURL() ?? '',
      clear: () => localCanvasRef.current?.clear(),
      isEmpty: () => localCanvasRef.current?.isEmpty() ?? true,
    };
  }, [hookCanvasRef]);

  // 启动游戏
  useEffect(() => {
    startGame(difficulty);
  }, []);

  // 超时自动提交
  useEffect(() => {
    if (state.timeRemaining <= 0 && state.game?.status === 'drawing' && isUserDrawing) {
      submitDrawing();
    }
  }, [state.timeRemaining, state.game?.status, isUserDrawing, submitDrawing]);

  // 游戏结束
  if (isGameOver && state.game) {
    return (
      <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center' }}>🏆 游戏结束</h2>

        <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
            {state.game.userScore > state.game.aiScore
              ? '🎉 你赢了！'
              : state.game.userScore < state.game.aiScore
                ? '😢 AI 赢了'
                : '🤝 平局！'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', fontSize: '2rem', fontWeight: 'bold' }}>
            <div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>你</div>
              <div style={{ color: '#2196f3' }}>{state.game.userScore}</div>
            </div>
            <div style={{ color: '#ccc' }}>:</div>
            <div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>AI</div>
              <div style={{ color: '#f44336' }}>{state.game.aiScore}</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3>回合回顾</h3>
          {state.game.rounds.map((round, i) => (
            <div
              key={i}
              style={{
                padding: '0.75rem',
                background: '#fafafa',
                borderRadius: '8px',
                marginBottom: '0.5rem',
                border: '1px solid #e0e0e0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>第 {round.roundNumber} 轮</strong>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  {round.role === 'user_draws' ? '🎨 你画 AI 猜' : '🤖 AI 画 你猜'}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#999' }}>
                  词: <strong>{round.targetWord}</strong>
                </span>
                <span style={{ fontWeight: 'bold', color: '#2196f3' }}>+{round.userRoundScore}分</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={() => {
              resetGame();
              startGame(difficulty);
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
          >
            🔄 再来一局
          </button>
          <button
            onClick={onNavigateHome}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1.1rem',
              background: '#f5f5f5',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            🏠 返回首页
          </button>
        </div>
      </div>
    );
  }

  // AI 识别中
  if (state.loading && state.game?.status === 'drawing') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>🤖 AI 识别中...</h2>
        <p style={{ color: '#999' }}>请稍候，AI 正在分析你的画作</p>
        <div style={{ marginTop: '1rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '4px solid #e0e0e0',
              borderTop: '4px solid #2196f3',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
            }}
          />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 轮次结束 — 展示结果
  if (state.game?.status === 'round_end' && currentRound) {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h2>📊 第 {currentRound.roundNumber} 轮结束</h2>

        <p style={{ fontSize: '1.5rem', margin: '1rem 0' }}>
          答案是：<strong style={{ color: '#e91e63' }}>{currentRound.targetWord}</strong>
        </p>

        {isUserDrawing && state.aiResult && (
          <div style={{ margin: '1rem 0' }}>
            <p>AI 的猜测：</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {state.aiResult.guesses.map((g, i) => (
                <span
                  key={i}
                  style={{
                    padding: '0.3rem 0.8rem',
                    borderRadius: '20px',
                    background: g.word === currentRound.targetWord ? '#e8f5e9' : '#fff3e0',
                    color: g.word === currentRound.targetWord ? '#2e7d32' : '#e65100',
                    fontWeight: 'bold',
                  }}
                >
                  {g.word} ({Math.round(g.confidence * 100)}%)
                </span>
              ))}
            </div>
            <p style={{ marginTop: '0.5rem', color: state.aiResult.isCorrect ? '#2e7d32' : '#f44336' }}>
              {state.aiResult.isCorrect ? '✅ AI 猜对了！' : '❌ AI 没有猜对'}
            </p>
          </div>
        )}

        {!isUserDrawing && (
          <div style={{ margin: '1rem 0' }}>
            <p style={{ color: state.guessFeedback?.includes('恭喜') ? '#2e7d32' : '#f44336' }}>
              {state.guessFeedback}
            </p>
          </div>
        )}

        <ScoreBoard
          userScore={state.game.userScore}
          aiScore={state.game.aiScore}
          currentRound={state.game.currentRound}
          totalRounds={state.game.totalRounds}
        />

        <button
          onClick={() => nextRound()}
          style={{
            marginTop: '1.5rem',
            padding: '0.75rem 2.5rem',
            fontSize: '1.1rem',
            background: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          {state.game.currentRound >= state.game.totalRounds ? '查看最终结果' : '下一轮 ➡️'}
        </button>
      </div>
    );
  }

  // 游戏进行中
  const isReadOnly = !isUserDrawing || state.loading;

  return (
    <div style={{ padding: '1rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* 错误提示 */}
      {state.error && (
        <div
          style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#ffebee',
            color: '#c62828',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{state.error}</span>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              color: '#c62828',
              cursor: 'pointer',
              fontSize: '1.2rem',
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {/* 主区域 */}
        <div style={{ flex: 3, minWidth: '300px' }}>
          {/* 顶部信息栏 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
              padding: '0.5rem 1rem',
              background: '#f5f5f5',
              borderRadius: '8px',
            }}
          >
            <span style={{ fontWeight: 'bold' }}>
              第 {state.game?.currentRound ?? 1}/{state.game?.totalRounds ?? 5} 轮
            </span>
            <Timer timeRemaining={state.timeRemaining} />
            <span>{isUserDrawing ? '🎨 你来画！' : '🤖 AI 在画...'}</span>
          </div>

          {/* 画布区域 */}
          {isUserDrawing ? (
            <div>
              {/* 目标词提示 */}
              {currentRound && (
                <div
                  style={{
                    textAlign: 'center',
                    marginBottom: '0.75rem',
                    padding: '0.5rem',
                    background: '#fff3e0',
                    borderRadius: '8px',
                    border: '2px dashed #ff9800',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: '#e65100' }}>你要画的是：</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#e91e63', marginLeft: '0.5rem' }}>
                    {currentRound.targetWord}
                  </span>
                </div>
              )}

              <Canvas
                ref={localCanvasRef}
                toolState={toolState}
                onToolChange={setToolState}
                readOnly={isReadOnly}
              />

              {/* 提交按钮 */}
              <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                <button
                  onClick={() => {
                    if (localCanvasRef.current?.isEmpty()) {
                      setShowEmptyWarning(true);
                      return;
                    }
                    setShowEmptyWarning(false);
                    submitDrawing();
                  }}
                  disabled={state.loading}
                  style={{
                    padding: '0.75rem 3rem',
                    fontSize: '1.2rem',
                    background: state.loading ? '#ccc' : '#ff5722',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: state.loading ? 'default' : 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  {state.loading ? '提交中...' : '✅ 提交绘画'}
                </button>
                {showEmptyWarning && (
                  <p style={{ color: '#f44336', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                    ⚠️ 画布是空的，请先画点什么再提交！
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div
                style={{
                  width: '100%',
                  aspectRatio: '4/3',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  border: '2px solid #333',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div>
                  {currentRound && (
                    <p style={{ fontSize: '2rem', letterSpacing: '0.5rem', fontFamily: 'monospace', marginBottom: '0.5rem' }}>
                      {'_'.repeat(currentRound.targetWord.length)}
                    </p>
                  )}
                  <p style={{ color: '#666', fontSize: '0.9rem' }}>
                    ({currentRound?.targetWord.length ?? '?'} 个字)
                  </p>
                  <p style={{ color: '#999', fontSize: '0.85rem' }}>
                    AI 正在展示它的画作... 请猜出它画的是什么！
                  </p>
                </div>
              </div>

              {/* 猜词输入 */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
                <input
                  type="text"
                  value={state.guessText}
                  onChange={(e) => setGuessText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitGuess(state.guessText);
                  }}
                  placeholder="输入你的猜测..."
                  style={{
                    padding: '0.6rem 1rem',
                    fontSize: '1rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    width: '250px',
                  }}
                />
                <button
                  onClick={() => submitGuess(state.guessText)}
                  disabled={!state.guessText.trim() || state.loading}
                  style={{
                    padding: '0.6rem 1.5rem',
                    background: state.loading ? '#ccc' : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: state.loading ? 'default' : 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  猜！
                </button>
              </div>

              {state.guessFeedback && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    background: state.guessFeedback.includes('恭喜') ? '#e8f5e9' : '#fff3e0',
                    color: state.guessFeedback.includes('恭喜') ? '#2e7d32' : '#e65100',
                  }}
                >
                  {state.guessFeedback}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 侧边栏 */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <ScoreBoard
            userScore={state.game?.userScore ?? 0}
            aiScore={state.game?.aiScore ?? 0}
            currentRound={state.game?.currentRound ?? 1}
            totalRounds={state.game?.totalRounds ?? 5}
          />

          {isUserDrawing && (
            <div style={{ marginTop: '1rem' }}>
              <Toolbar
                toolState={toolState}
                onToolChange={setToolState}
                canUndo={(localCanvasRef.current?.getStrokeCount() ?? 0) > 0}
                canRedo={(localCanvasRef.current?.getUndoCount() ?? 0) > 0}
                onUndo={() => localCanvasRef.current?.undo()}
                onRedo={() => localCanvasRef.current?.redo()}
                onClear={() => localCanvasRef.current?.clear()}
                disabled={isReadOnly}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
