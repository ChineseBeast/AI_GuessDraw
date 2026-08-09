import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useGame } from '../../hooks/useGame';
import { useMultiplayerCanvas } from '../../hooks/useMultiplayerCanvas';
import { CanvasView } from './components/CanvasView';
import { GuessPanel } from './components/GuessPanel';
import { PlayerList } from './components/PlayerList';
import type { WSPlayerInfo, AIStatusEvent, AIGuessEvent, DrawerFinishedEvent } from '@draw-guess/shared';

import type { GameStartedEvent } from '@draw-guess/shared';

interface GamePageProps {
  userId: string;
  nickname: string;
  serverUrl: string;
  gameInit?: GameStartedEvent;
  players?: WSPlayerInfo[];
  hostId?: string;
  onBackToLobby?: () => void;
  onNavigateHome?: () => void;
}

export const MultiplayerGame: React.FC<GamePageProps> = ({
  userId,
  nickname,
  serverUrl,
  gameInit,
  players = [],
  hostId,
  onBackToLobby,
  onNavigateHome,
}) => {
  const { connected, emit, on, error: socketError } = useSocket({ serverUrl, userId, nickname });
  const { game, submitGuess, isDrawer } = useGame({ on, emit, gameInit });

  const { strokes, sendCanvasAction, sendUndo, sendClear } = useMultiplayerCanvas({
    on,
    emit,
    isDrawer,
    connected,
  });

  const [timer, setTimer] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [gamePlayers, setGamePlayers] = useState<WSPlayerInfo[]>(players);
  // AI 玩家状态提示（绘画中/绘画完成/猜词/绘画已提交）
  const [aiStatus, setAiStatus] = useState<{ text: string; kind: 'drawing' | 'draw_done' | 'guess' | 'guess_correct' | 'drawer_finished' } | null>(null);

  // 更新玩家列表
  useEffect(() => {
    const unsub1 = on<{ player: WSPlayerInfo }>('player_joined', (data) => {
      setGamePlayers((prev) => [...prev, data.player]);
    });
    const unsub2 = on<{ playerId: string }>('player_left', (data) => {
      setGamePlayers((prev) => prev.filter((p) => p.userId !== data.playerId));
    });
    const unsub3 = on<{ playerId: string }>('player_disconnected', (data) => {
      setGamePlayers((prev) =>
        prev.map((p) => (p.userId === data.playerId ? { ...p, connectionStatus: 'disconnected' as const } : p))
      );
    });
    const unsub4 = on<{ playerId: string }>('player_reconnected', (data) => {
      setGamePlayers((prev) =>
        prev.map((p) => (p.userId === data.playerId ? { ...p, connectionStatus: 'connected' as const } : p))
      );
    });
    const unsub5 = on<{ newRole: string }>('role_changed', (data) => {
      if (data.newRole === 'guesser') setIsSpectator(false);
    });
    const unsub6 = on<{ message: string }>('join_next_game_prompt', () => {
      setShowJoinPrompt(true);
    });

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6();
    };
  }, [on]);

  // 监听 AI 玩家状态事件
  useEffect(() => {
    const unsub1 = on<AIStatusEvent>('ai_status', (data) => {
      if (data.status === 'drawing') {
        setAiStatus({ kind: 'drawing', text: '🤖 AI 正在绘画，请稍候...' });
      } else if (data.status === 'draw_done') {
        setAiStatus({ kind: 'draw_done', text: '🤖 AI 已画完，快猜词吧！' });
      } else if (data.status === 'thinking') {
        setAiStatus({ kind: 'guess', text: '🤖 AI 正在观察画作...' });
      }
    });
    const unsub2 = on<AIGuessEvent>('ai_guess', (data) => {
      if (data.isCorrect && data.matchedWord) {
        setAiStatus({ kind: 'guess_correct', text: `🤖 AI 猜对了！答案是「${data.matchedWord}」` });
      } else if (data.guesses.length > 0) {
        const guessText = data.guesses.map((g) => `${g.word}(${Math.round(g.confidence * 100)}%)`).join('、');
        setAiStatus({ kind: 'guess', text: `🤖 AI 猜了：${guessText}` });
      }
    });
    const unsub3 = on<DrawerFinishedEvent>('drawer_finished', () => {
      setAiStatus({ kind: 'drawer_finished', text: '✋ 绘画已提交，继续猜词直到本轮结束...' });
    });

    return () => {
      unsub1(); unsub2(); unsub3();
    };
  }, [on]);

  // 每轮开始清空 AI 状态提示
  useEffect(() => {
    setAiStatus(null);
  }, [game.currentRound]);

  // 倒计时
  useEffect(() => {
    if (game.status === 'playing') {
      setTimer(game.timeLimit);
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [game.status, game.timeLimit, game.currentRound]);

  // 更新玩家分数（从 round_ended 事件）
  useEffect(() => {
    if (game.scores) {
      setGamePlayers((prev) =>
        prev.map((p) => ({
          ...p,
          score: game.scores[p.userId] ?? p.score,
        }))
      );
    }
  }, [game.scores]);

  // ─── 连接中 ──────────────────────────────────
  if (!connected) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>连接中...</h2>
        <div style={{ marginTop: '1rem' }}>
          <div
            style={{
              width: '40px', height: '40px', border: '4px solid #e0e0e0',
              borderTop: '4px solid #2196f3', borderRadius: '50%',
              animation: 'spin 1s linear infinite', margin: '0 auto',
            }}
          />
        </div>
        {socketError && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#ffebee', color: '#c62828', borderRadius: '8px', maxWidth: '400px', margin: '1rem auto' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>❌ 连接失败</p>
            <p style={{ fontSize: '0.9rem' }}>{socketError}</p>
            <button onClick={() => window.location.reload()} style={{ marginTop: '0.75rem', padding: '0.5rem 1.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>刷新重试</button>
          </div>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── 游戏结束 ────────────────────────────────
  if (game.status === 'game_end' && game.gameEnded) {
    return (
      <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center' }}>🏆 游戏结束</h2>

        <div style={{ marginBottom: '2rem' }}>
          <h3>最终排名</h3>
          {game.gameEnded.finalScores.map((ps) => (
            <div
              key={ps.playerId}
              style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '0.75rem', marginBottom: '0.5rem',
                background: ps.rank === 1 ? '#fff8e1' : '#f5f5f5',
                borderRadius: '8px',
                border: ps.rank === 1 ? '2px solid #ffc107' : '1px solid #e0e0e0',
              }}
            >
              <span>
                {ps.rank === 1 && '🥇 '}{ps.rank === 2 && '🥈 '}{ps.rank === 3 && '🥉 '}
                {ps.nickname} {ps.playerId === userId && '(你)'}
              </span>
              <span style={{ fontWeight: 'bold' }}>{ps.totalScore} 分</span>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3>回合回顾</h3>
          {game.gameEnded.roundsSummary.map((r) => (
            <div key={r.roundNumber} style={{ padding: '0.5rem', marginBottom: '0.5rem', background: '#fafafa', borderRadius: '6px' }}>
              <strong>第 {r.roundNumber} 轮</strong> — {r.drawer} 画了「{r.targetWord}」
              {r.correctGuessers.length > 0 && (
                <span style={{ color: '#4caf50' }}> ✅ {r.correctGuessers.join(', ')} 猜对了</span>
              )}
              {r.correctGuessers.length === 0 && (
                <span style={{ color: '#f44336' }}> ❌ 无人猜对</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              style={{
                padding: '0.75rem 2rem', fontSize: '1rem', background: '#2196f3', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
              }}
            >
              🔙 返回大厅
            </button>
          )}
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              style={{
                padding: '0.75rem 2rem', fontSize: '1rem', background: '#f5f5f5',
                border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer',
              }}
            >
              🏠 返回首页
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── 轮次结束 ────────────────────────────────
  if (game.status === 'round_end' && game.roundEnded) {
    return (
      <div style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <h2>📊 第 {game.roundEnded.roundNumber} 轮结束</h2>
        <p style={{ fontSize: '1.5rem', margin: '1rem 0' }}>
          答案是：<strong style={{ color: '#e91e63' }}>{game.roundEnded.targetWord}</strong>
        </p>
        <p>绘画者 {game.roundEnded.drawerNickname} 获得 {game.roundEnded.drawerScore} 分</p>

        <div style={{ marginTop: '1.5rem' }}>
          <h3>当前得分</h3>
          {Object.entries(game.roundEnded.totalScores)
            .sort(([, a], [, b]) => b - a)
            .map(([pid, score]) => (
              <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem' }}>
                <span>{pid === userId ? '👉 你' : pid.substring(0, 8)}</span>
                <span>{score} 分</span>
              </div>
            ))}
        </div>

        <p style={{ marginTop: '1.5rem', color: '#999' }}>即将开始下一轮...</p>
      </div>
    );
  }

  // ─── 等待/倒计时 ─────────────────────────────
  if (game.status === 'waiting' || game.status === 'countdown') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>{game.status === 'countdown' ? '🎬 准备开始！' : '⏳ 等待游戏开始...'}</h2>
        {game.status === 'countdown' && (
          <p style={{ fontSize: '2rem', color: '#ff5722' }}>即将揭晓词汇...</p>
        )}
      </div>
    );
  }

  // ─── 游戏中 ──────────────────────────────────
  return (
    <div style={{ padding: '1rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* 断线覆盖 */}
      {!connected && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
            <h2>⚠️ 连接断开</h2>
            <p>正在尝试重新连接...</p>
            <p style={{ color: '#f44336', fontSize: '0.9rem' }}>30 秒内重连可恢复游戏状态</p>
          </div>
        </div>
      )}

      {/* 观众标识 */}
      {isSpectator && (
        <div style={{
          background: '#fff3e0', padding: '0.5rem 1rem', borderRadius: '6px',
          marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>👀 <strong>观看中</strong></span>
          {showJoinPrompt && (
            <button
              onClick={() => { emit('accept_join_next_game'); setShowJoinPrompt(false); }}
              style={{
                padding: '0.4rem 1rem', background: '#4caf50', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
              }}
            >
              加入下一局
            </button>
          )}
        </div>
      )}

      {/* 顶部信息栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1rem', padding: '0.75rem', background: '#f5f5f5', borderRadius: '8px',
      }}>
        <span><strong>第 {game.currentRound}/{game.totalRounds} 轮</strong></span>
        <span style={{ fontSize: '1.5rem', color: timer <= 10 ? '#f44336' : '#333' }}>
          ⏱ {timer}s
        </span>
        <span>{isDrawer ? '🎨 你是绘画者' : isSpectator ? '👀 观看中' : '🔍 你是猜词者'}</span>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {/* 主区域 — 画布 */}
        <div style={{ flex: 3, minWidth: '300px' }}>
          {isDrawer && game.targetWord && (
            <div style={{
              textAlign: 'center', marginBottom: '0.75rem', padding: '0.5rem',
              background: '#fff3e0', borderRadius: '8px', border: '2px dashed #ff9800',
            }}>
              <span style={{ fontSize: '0.85rem', color: '#e65100' }}>你要画的是：</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#e91e63', marginLeft: '0.5rem' }}>
                {game.targetWord}
              </span>
            </div>
          )}

          {!isDrawer && (
            <div style={{
              textAlign: 'center', marginBottom: '0.75rem', padding: '0.5rem',
              background: '#f5f5f5', borderRadius: '8px',
            }}>
              {game.wordHint ? (
                <span style={{ fontSize: '2rem', letterSpacing: '0.5rem', fontFamily: 'monospace' }}>
                  {game.wordHint}
                </span>
              ) : (
                <span style={{ color: '#999' }}>等待绘画者开始...</span>
              )}
              <span style={{ color: '#666', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                ({game.wordLength} 个字)
              </span>
            </div>
          )}

          <CanvasView
            isDrawer={isDrawer}
            connected={connected}
            strokes={strokes}
            onStrokeComplete={sendCanvasAction}
            onUndo={sendUndo}
            onClear={sendClear}
          />

          {/* AI 玩家状态提示 */}
          {aiStatus && (
            <div style={{
              textAlign: 'center', marginTop: '0.75rem', padding: '0.5rem',
              background: aiStatus.kind === 'guess_correct' ? '#e8f5e9' : '#ede7f6',
              borderRadius: '8px', fontSize: '0.95rem', color: aiStatus.kind === 'guess_correct' ? '#2e7d32' : '#4a148c',
            }}>
              {aiStatus.text}
            </div>
          )}
        </div>

        {/* 侧边栏 */}
        <div style={{ flex: 1, minWidth: '220px' }}>
          <PlayerList
            players={gamePlayers.map(p => ({
              ...p,
              // 以当前轮次画者为准，否则所有玩家一直显示为猜词者
              role: p.userId === game.drawerId ? 'drawer' : p.role,
            }))}
            currentUserId={userId}
            hostId={hostId}
          />

          <GuessPanel
            isDrawer={isDrawer}
            isSpectator={isSpectator}
            guessResult={game.guessResult ?? null}
            correctGuesses={game.correctGuesses}
            onSubmitGuess={submitGuess}
          />
        </div>
      </div>
    </div>
  );
};
