import { useReducer, useCallback, useRef } from 'react';
import type {
  SinglePlayerGame,
  SinglePlayerRound,
  Difficulty,
  AIRecognizeResponse,
  AIDrawStroke,
} from '@draw-guess/shared';
import { TOTAL_ROUNDS, ROUND_TIME } from '@draw-guess/shared';
import { AIService } from '../services/ai.service';

// ─── State ────────────────────────────────────────

interface SinglePlayerState {
  game: SinglePlayerGame | null;
  loading: boolean;
  error: string | null;
  timeRemaining: number;
  guessText: string;
  guessFeedback: string | null;
  aiResult: AIRecognizeResponse | null;
  /** AI 画的笔画轨迹（ai_draws 轮次用） */
  aiStrokes: AIDrawStroke[];
}

const initialState: SinglePlayerState = {
  game: null,
  loading: false,
  error: null,
  timeRemaining: ROUND_TIME,
  guessText: '',
  guessFeedback: null,
  aiResult: null,
  aiStrokes: [],
};

// ─── Scoring ──────────────────────────────────────

/** 每轮得分（猜对一轮加 1 分，谁猜对给谁加分）。 */
export interface RoundScore {
  userGain: number;
  aiGain: number;
}

/**
 * 计算单轮得分：猜对加 1 分，猜错加 0 分。
 * - `user_draws`（用户画 AI 猜）：AI 猜对则 AI 加分，否则用户加分（用户成功让 AI 没猜对）。
 * - `ai_draws`（AI 画 用户猜）：用户猜对则用户加分，否则 AI 加分。
 */
export function calculateRoundScore(isCorrect: boolean, role: SinglePlayerRound['role']): RoundScore {
  if (role === 'user_draws') {
    // isCorrect 表示 AI 是否猜对
    return isCorrect ? { userGain: 0, aiGain: 1 } : { userGain: 1, aiGain: 0 };
  }
  // ai_draws：isCorrect 表示用户是否猜对
  return isCorrect ? { userGain: 1, aiGain: 0 } : { userGain: 0, aiGain: 1 };
}

// ─── Actions ──────────────────────────────────────

type Action =
  | { type: 'START_GAME'; game: SinglePlayerGame }
  | { type: 'TICK'; timeRemaining: number }
  | { type: 'SUBMIT_DRAWING' }
  | { type: 'AI_RECOGNIZED'; result: AIRecognizeResponse; score: RoundScore }
  | { type: 'AI_RECOGNIZE_ERROR'; error: string }
  | { type: 'SET_GUESS_TEXT'; text: string }
  | { type: 'SUBMIT_GUESS' }
  | { type: 'GUESS_RESULT'; isCorrect: boolean; feedback: string; score: RoundScore }
  | { type: 'NEXT_ROUND'; targetWord: string; round: SinglePlayerRound }
  | { type: 'AI_DRAWING_GENERATED'; strokes: AIDrawStroke[] }
  | { type: 'AI_DRAWING_ERROR'; error: string }
  | { type: 'END_GAME' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

// ─── Reducer ──────────────────────────────────────

function reducer(state: SinglePlayerState, action: Action): SinglePlayerState {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...initialState,
        game: action.game,
        timeRemaining: ROUND_TIME,
      };

    case 'TICK':
      return { ...state, timeRemaining: action.timeRemaining };

    case 'SUBMIT_DRAWING':
      return {
        ...state,
        loading: true,
        error: null,
      };

    case 'AI_RECOGNIZED': {
      if (!state.game) return state;
      const rounds = [...state.game.rounds];
      const currentRound = { ...rounds[rounds.length - 1] };
      currentRound.aiGuesses = action.result.guesses;
      // 用户画 AI 猜：AI 猜对则 AI 得分，否则用户得分
      currentRound.aiRoundScore = action.score.aiGain;
      currentRound.userRoundScore = action.score.userGain;
      rounds[rounds.length - 1] = currentRound;

      const userScore = rounds.reduce((sum, r) => sum + r.userRoundScore, 0);
      const aiScore = rounds.reduce((sum, r) => sum + r.aiRoundScore, 0);

      return {
        ...state,
        loading: false,
        aiResult: action.result,
        game: {
          ...state.game,
          rounds,
          userScore,
          aiScore,
          status: 'round_end',
        },
      };
    }

    case 'AI_RECOGNIZE_ERROR':
      return {
        ...state,
        loading: false,
        error: action.error,
      };

    case 'SET_GUESS_TEXT':
      return { ...state, guessText: action.text };

    case 'SUBMIT_GUESS':
      return { ...state, loading: true };

    case 'GUESS_RESULT': {
      if (!state.game) return state;
      const rounds = [...state.game.rounds];
      const currentRound = { ...rounds[rounds.length - 1] };
      currentRound.userGuessedCorrectly = action.isCorrect;
      // AI 画 用户猜：用户猜对则用户得分，否则 AI 得分
      currentRound.userRoundScore = action.score.userGain;
      currentRound.aiRoundScore = action.score.aiGain;
      rounds[rounds.length - 1] = currentRound;

      const userScore = rounds.reduce((sum, r) => sum + r.userRoundScore, 0);
      const aiScore = rounds.reduce((sum, r) => sum + r.aiRoundScore, 0);

      return {
        ...state,
        loading: false,
        guessFeedback: action.feedback,
        guessText: '',
        game: {
          ...state.game,
          rounds,
          userScore,
          aiScore,
          status: 'round_end',
        },
      };
    }

    case 'NEXT_ROUND': {
      if (!state.game) return state;
      const newRound: SinglePlayerRound = action.round;
      return {
        ...state,
        loading: newRound.role === 'ai_draws', // AI 画轮次：加载笔画时显示 loading
        aiResult: null,
        aiStrokes: [],
        guessFeedback: null,
        guessText: '',
        timeRemaining: ROUND_TIME,
        game: {
          ...state.game,
          currentRound: state.game.currentRound + 1,
          rounds: [...state.game.rounds, newRound],
          status: 'drawing',
        },
      };
    }

    case 'AI_DRAWING_GENERATED': {
      if (!state.game) return state;
      // 笔画生成完成，进入猜测阶段
      return {
        ...state,
        loading: false,
        aiStrokes: action.strokes,
        game: {
          ...state.game,
          status: 'guessing',
        },
      };
    }

    case 'AI_DRAWING_ERROR':
      return {
        ...state,
        loading: false,
        error: action.error,
      };

    case 'END_GAME':
      if (!state.game) return state;
      return {
        ...state,
        game: { ...state.game, status: 'game_end' },
      };

    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────

export function useSinglePlayer() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const canvasRef = useRef<{ getImageDataURL: () => string; clear: () => void; isEmpty: () => boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Timer ─────────────────────────────────────

  const startTimer = useCallback(() => {
    stopTimer();
    let currentTime = ROUND_TIME;
    timerRef.current = setInterval(() => {
      currentTime -= 1;
      dispatch({ type: 'TICK', timeRemaining: Math.max(0, currentTime) });
      if (currentTime <= 0) {
        stopTimer();
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ─── Game Flow ─────────────────────────────────

  const startGame = useCallback(
    async (difficulty: Difficulty) => {
      dispatch({ type: 'CLEAR_ERROR' });

      try {
        // 获取第一轮的目标词
        const { word } = await AIService.getWord(difficulty);

        const game: SinglePlayerGame = {
          id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: 'drawing',
          currentRound: 1,
          totalRounds: TOTAL_ROUNDS,
          difficulty,
          rounds: [
            {
              roundNumber: 1,
              role: 'user_draws',
              targetWord: word,
              wordDifficulty: difficulty,
              timeLimit: ROUND_TIME,
              timeRemaining: ROUND_TIME,
              userRoundScore: 0,
              aiRoundScore: 0,
            },
          ],
          userScore: 0,
          aiScore: 0,
          startedAt: new Date().toISOString(),
        };

        dispatch({ type: 'START_GAME', game });
        startTimer();
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : '开始游戏失败',
        });
      }
    },
    [startTimer]
  );

  const submitDrawing = useCallback(async () => {
    const game = (state as SinglePlayerState).game;
    if (!game || game.status !== 'drawing') return;

    const imageDataUrl = canvasRef.current?.getImageDataURL();
    if (!imageDataUrl) {
      dispatch({ type: 'SET_ERROR', error: '无法获取画布数据' });
      return;
    }

    stopTimer();
    dispatch({ type: 'SUBMIT_DRAWING' });

    const currentRound = game.rounds[game.rounds.length - 1];

    try {
      const result = await AIService.recognize(imageDataUrl, currentRound.targetWord, game.difficulty);
      // 用户画 AI 猜：result.isCorrect 表示 AI 是否猜对
      const score = calculateRoundScore(result.isCorrect, 'user_draws');

      dispatch({ type: 'AI_RECOGNIZED', result, score });
    } catch (err) {
      dispatch({
        type: 'AI_RECOGNIZE_ERROR',
        error: err instanceof Error ? err.message : 'AI 识别失败',
      });
    }
  }, [state, stopTimer]);

  const submitGuess = useCallback(
    async (text: string) => {
      const game = (state as SinglePlayerState).game;
      if (!game || game.status !== 'guessing') return;

      dispatch({ type: 'SUBMIT_GUESS' });

      const currentRound = game.rounds[game.rounds.length - 1];
      const isCorrect = text.trim() === currentRound.targetWord;

      let feedback: string;
      if (isCorrect) {
        feedback = '🎉 恭喜！你猜对了！';
      } else if (text.trim().length === currentRound.targetWord.length) {
        feedback = '📏 字数对了，但内容不对';
      } else {
        feedback = '❌ 不对，再试试！';
      }

      stopTimer();
      // AI 画 用户猜：isCorrect 表示用户是否猜对
      const score = calculateRoundScore(isCorrect, 'ai_draws');

      dispatch({ type: 'GUESS_RESULT', isCorrect, feedback, score });
    },
    [state, stopTimer]
  );

  const nextRound = useCallback(async () => {
    const game = (state as SinglePlayerState).game;
    if (!game) return;

    if (game.currentRound >= game.totalRounds) {
      dispatch({ type: 'END_GAME' });
      return;
    }

    const usedWords = game.rounds.map((r) => r.targetWord);
    const nextRoundNumber = game.currentRound + 1;
    const role = nextRoundNumber % 2 === 1 ? 'user_draws' : 'ai_draws';

    try {
      const { word } = await AIService.getWord(game.difficulty, usedWords);

      const newRound: SinglePlayerRound = {
        roundNumber: nextRoundNumber,
        role,
        targetWord: word,
        wordDifficulty: game.difficulty,
        timeLimit: ROUND_TIME,
        timeRemaining: ROUND_TIME,
        userRoundScore: 0,
        aiRoundScore: 0,
      };

      dispatch({ type: 'NEXT_ROUND', targetWord: word, round: newRound });

      if (role === 'user_draws') {
        // 清空画布
        canvasRef.current?.clear();
        startTimer();
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : '获取词汇失败',
      });
    }
  }, [state, startTimer]);

  const resetGame = useCallback(() => {
    stopTimer();
    dispatch({ type: 'RESET' });
    canvasRef.current?.clear();
  }, [stopTimer]);

  /** AI 画轮次：调用后端生成笔画轨迹，返回笔画供页面在 Canvas 上绘制。 */
  const generateAiDrawing = useCallback(async (): Promise<AIDrawStroke[]> => {
    const game = (state as SinglePlayerState).game;
    if (!game) return [];

    const currentRound = game.rounds[game.rounds.length - 1];
    if (currentRound.role !== 'ai_draws') return [];

    try {
      const result = await AIService.generateDrawing(currentRound.targetWord, game.difficulty);
      dispatch({ type: 'AI_DRAWING_GENERATED', strokes: result.strokes });
      startTimer();
      return result.strokes;
    } catch (err) {
      dispatch({
        type: 'AI_DRAWING_ERROR',
        error: err instanceof Error ? err.message : 'AI 绘画生成失败',
      });
      return [];
    }
  }, [state, startTimer]);

  // ─── Current Round Info ────────────────────────

  const currentRound = state.game?.rounds[state.game.rounds.length - 1] ?? null;
  const isUserDrawing = currentRound?.role === 'user_draws';
  const isGameOver = state.game?.status === 'game_end';

  return {
    state,
    canvasRef,
    currentRound,
    isUserDrawing,
    isGameOver,
    startGame,
    submitDrawing,
    submitGuess,
    nextRound,
    resetGame,
    generateAiDrawing,
    setGuessText: (text: string) => dispatch({ type: 'SET_GUESS_TEXT', text }),
    clearError: () => dispatch({ type: 'CLEAR_ERROR' }),
  };
}
