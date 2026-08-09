import React, { useRef, useEffect } from 'react';
import { Canvas, type CanvasRef } from '@draw-guess/ui';
import type { ToolState } from '@draw-guess/ui';
import { DEFAULT_TOOL_STATE } from '@draw-guess/ui';
import type { Provider } from '@draw-guess/shared';
import { useSinglePlayer } from '../../hooks/useSinglePlayer';
import { useAuth } from '../../hooks/useAuth';
import { LeaderboardService } from '../../services/leaderboard.service';
import { Toolbar } from './components/Toolbar';
import { Timer } from './components/Timer';
import { ScoreBoard } from './components/ScoreBoard';

interface SinglePlayerGameProps {
  difficulty: 'easy' | 'medium' | 'hard';
  provider: Provider;
  onNavigateHome: () => void;
}

export const SinglePlayerGame: React.FC<SinglePlayerGameProps> = ({ difficulty, provider, onNavigateHome }) => {
  const {
    state,
    canvasRef: hookCanvasRef,
    currentRound,
    isUserDrawing,
    isGameOver,
    maxGuesses,
    guessesRemaining,
    startGame,
    submitDrawing,
    submitGuess,
    nextRound,
    resetGame,
    generateAiDrawing,
    setGuessText,
    clearError,
  } = useSinglePlayer(provider);

  const { user, isAuthenticated } = useAuth();
  const localCanvasRef = useRef<CanvasRef>(null);
  const [toolState, setToolState] = React.useState<ToolState>(DEFAULT_TOOL_STATE);
  const [showEmptyWarning, setShowEmptyWarning] = React.useState(false);
  const scoreSubmittedRef = useRef(false);
  const [flashCorrect, setFlashCorrect] = React.useState(false);
  const [roundTransition, setRoundTransition] = React.useState(false);
  const [hintVisible, setHintVisible] = React.useState(false);

  // 轮次切换时重置提示状态，避免上一轮点开的提示残留到下一轮（按钮保持按下/toast 直接弹出）
  useEffect(() => {
    setHintVisible(false);
  }, [currentRound?.roundNumber]);

  // AI 画轮次：进入 drawing 阶段后请求 AI 生成笔画并在 Canvas 上动画绘制
  const aiDrawTriggeredRef = useRef(false);
  useEffect(() => {
    if (!currentRound || isUserDrawing) {
      aiDrawTriggeredRef.current = false;
      return;
    }
    // ai_draws 轮次且处于 drawing 阶段（AI 正在画/加载）
    if (state.game?.status !== 'drawing') return;
    if (aiDrawTriggeredRef.current) return; // 防止重复触发
    aiDrawTriggeredRef.current = true;

    let cancelled = false;
    (async () => {
      const strokes = await generateAiDrawing();
      if (cancelled || strokes.length === 0) return;
      // 在只读 Canvas 上动画回放 AI 的笔画
      localCanvasRef.current?.loadStrokes(
        strokes.map((s) => ({ points: s.points, color: s.color, width: s.width })),
        { animate: true, speed: 120 }
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [currentRound, isUserDrawing, state.game?.status, generateAiDrawing]);

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

  // AI 画回合猜对：触发正确闪烁动画
  useEffect(() => {
    if (state.game?.status === 'round_end' && !isUserDrawing && currentRound?.userGuessedCorrectly) {
      setFlashCorrect(true);
      const t = setTimeout(() => setFlashCorrect(false), 600);
      return () => clearTimeout(t);
    }
  }, [state.game?.status, isUserDrawing, currentRound?.userGuessedCorrectly]);

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <strong>第 {round.roundNumber} 轮</strong>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  {round.role === 'user_draws' ? '🎨 你画 AI 猜' : '🤖 AI 画 你猜'}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#999' }}>
                  词: <strong>{round.targetWord}</strong>
                </span>
                <span style={{ display: 'flex', gap: '0.75rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#2196f3' }}>你 +{round.userRoundScore}</span>
                  <span style={{ fontWeight: 'bold', color: '#f44336' }}>AI +{round.aiRoundScore}</span>
                </span>
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

  // AI 识别中（仅我画AI猜：用户提交后等待识别结果）
  if (state.loading && state.game?.status === 'drawing' && isUserDrawing) {
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
    // 局部引用：避免在 map 回调中丢失 state.aiResult 的非空收窄
    const aiResult = state.aiResult;
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h2>📊 第 {currentRound.roundNumber} 轮结束</h2>

        <p style={{ fontSize: '1.5rem', margin: '1rem 0' }}>
          答案是：<strong style={{ color: '#e91e63' }}>{currentRound.targetWord}</strong>
        </p>

        {isUserDrawing && aiResult && (
          <div style={{ margin: '1rem 0' }}>
            <p>AI 的猜测：</p>
            {aiResult.guesses.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {aiResult.guesses.map((g, i) => {
                  // 命中项（matchedGuess）与首个猜测可能不是同一个，需单独高亮
                  const isMatched = !!aiResult.matchedGuess && g.word === aiResult.matchedGuess.word;
                  return (
                    <span
                      key={i}
                      style={{
                        padding: '0.5rem 1.2rem',
                        borderRadius: '20px',
                        background: isMatched ? '#e8f5e9' : '#fff3e0',
                        color: isMatched ? '#2e7d32' : '#e65100',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        border: isMatched ? '2px solid #4caf50' : 'none',
                      }}
                    >
                      {g.word}（{Math.round(g.confidence * 100)}%）
                    </span>
                  );
                })}
              </div>
            ) : (
              <span style={{ color: '#999' }}>AI 未能给出猜测</span>
            )}
            <p style={{ marginTop: '0.5rem', color: aiResult.isCorrect ? '#2e7d32' : '#f44336' }}>
              {aiResult.isCorrect && aiResult.matchedGuess
                ? `✅ AI 猜对了！它猜的是「${aiResult.matchedGuess.word}」`
                : aiResult.isCorrect
                  ? '✅ AI 猜对了！'
                  : '❌ AI 没有猜对'}
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
          onClick={() => {
            setRoundTransition(true);
            setTimeout(() => { setRoundTransition(false); nextRound(); }, 800);
          }}
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
            style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '1.2rem' }}
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
            {!isUserDrawing && (
              <button
                onClick={() => setHintVisible((v) => !v)}
                style={{
                  padding: '0.3rem 0.7rem',
                  background: hintVisible ? '#e3f2fd' : '#fff',
                  border: '1px solid #2196f3',
                  borderRadius: '6px',
                  color: '#2196f3',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                }}
              >
                💡 提示
              </button>
            )}
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
            <div>
              {/* 字数提示 */}
              {currentRound && (
                <div
                  style={{
                    textAlign: 'center',
                    marginBottom: '0.75rem',
                    padding: '0.5rem',
                    background: '#e3f2fd',
                    borderRadius: '8px',
                    border: '2px dashed #2196f3',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: '#1565c0' }}>提示：AI 画的是一个 </span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1565c0' }}>
                    {currentRound.targetWord.length}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#1565c0' }}> 字的词</span>
                </div>
              )}

              {/* 提示 toast：字数 + 首字 */}
              {hintVisible && currentRound && (
                <div
                  style={{
                    textAlign: 'center',
                    marginBottom: '0.75rem',
                    padding: '0.5rem',
                    background: '#fff3e0',
                    borderRadius: '8px',
                    border: '1px solid #ff9800',
                    color: '#e65100',
                    fontSize: '0.9rem',
                  }}
                >
                  💡 提示：{currentRound.targetWord.length} 字词，第 1 个字是「{currentRound.targetWord[0]}」
                </div>
              )}

              {/* AI 画作画布（只读，加载笔画后逐笔动画绘制） */}
              <Canvas ref={localCanvasRef} toolState={toolState} onToolChange={setToolState} readOnly />

              {/* AI 正在画时的加载提示 */}
              {state.loading && (
                <p style={{ textAlign: 'center', color: '#999', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  🤖 AI 正在构思并绘制它的画作，请稍候...
                </p>
              )}

              {/* 兜底笔画提示：AI 模型输出失败时回退为简笔画，笔画少于 3 条 */}
              {!state.loading && state.aiStrokes.length > 0 && state.aiStrokes.length < 3 && (
                <p style={{ textAlign: 'center', color: '#999', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  AI 画技不佳，尽力猜 😅
                </p>
              )}

              {/* 历史猜测 */}
              {currentRound?.userGuesses && currentRound.userGuesses.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {currentRound.userGuesses.slice(-3).map((g, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '0.3rem 0.8rem',
                        background: '#fff3e0',
                        borderRadius: '16px',
                        fontSize: '0.85rem',
                        color: '#e65100',
                        border: '1px solid #ffb74d',
                      }}
                    >
                      {g} ✕
                    </span>
                  ))}
                </div>
              )}

              {/* 猜词输入（笔画绘制完成后 status=guessing 才可猜） */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
                <input
                  type="text"
                  value={state.guessText}
                  onChange={(e) => setGuessText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitGuess(state.guessText);
                  }}
                  placeholder={state.game?.status === 'guessing' ? `输入猜测（剩余 ${guessesRemaining} 次）...` : '等 AI 画完再猜...'}
                  disabled={state.game?.status !== 'guessing'}
                  style={{
                    padding: '0.6rem 1rem',
                    fontSize: '1rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    width: '250px',
                    background: state.game?.status === 'guessing' ? '#fff' : '#f5f5f5',
                  }}
                />
                <button
                  onClick={() => submitGuess(state.guessText)}
                  disabled={!state.guessText.trim() || state.loading || state.game?.status !== 'guessing'}
                  style={{
                    padding: '0.6rem 1.5rem',
                    background: state.loading || state.game?.status !== 'guessing' ? '#ccc' : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: state.loading || state.game?.status !== 'guessing' ? 'default' : 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  猜！
                </button>
              </div>

              {/* 剩余次数 */}
              {state.game?.status === 'guessing' && (
                <div style={{ textAlign: 'center', marginTop: '0.4rem', fontSize: '0.8rem', color: '#999' }}>
                  剩余 {guessesRemaining}/{maxGuesses} 次猜测机会
                </div>
              )}

              {/* 反馈 */}
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

      {/* 正确闪烁动画 */}
      {flashCorrect && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(76,175,80,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'flashFade 0.6s ease-out forwards',
          }}
        >
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            ✅ 正确！
          </div>
          <style>{`@keyframes flashFade { 0%{opacity:1} 100%{opacity:0} }`}</style>
        </div>
      )}

      {/* 轮次过渡动画 */}
      {roundTransition && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'transFade 0.8s ease-out forwards',
          }}
        >
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>
            下一轮 ➡️
          </div>
          <style>{`@keyframes transFade { 0%{opacity:0} 30%{opacity:1} 100%{opacity:0} }`}</style>
        </div>
      )}
    </div>
  );
};
