import { useReducer, useCallback, useRef } from 'react';
import type {
  SinglePlayerGame,
  SinglePlayerRound,
  Difficulty,
  AIRecognizeResponse,
  ScoreBreakdown,
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
}

const initialState: SinglePlayerState = {
  game: null,
  loading: false,
  error: null,
  timeRemaining: ROUND_TIME,
  guessText: '',
  guessFeedback: null,
  aiResult: null,
};

// ─── Actions ──────────────────────────────────────

type Action =
  | { type: 'START_GAME'; game: SinglePlayerGame }
  | { type: 'TICK'; timeRemaining: number }
  | { type: 'SUBMIT_DRAWING' }
  | { type: 'AI_RECOGNIZED'; result: AIRecognizeResponse; scoreBreakdown: ScoreBreakdown }
  | { type: 'AI_RECOGNIZE_ERROR'; error: string }
  | { type: 'SET_GUESS_TEXT'; text: string }
  | { type: 'SUBMIT_GUESS' }
  | { type: 'GUESS_RESULT'; isCorrect: boolean; feedback: string; scoreBreakdown: ScoreBreakdown }
  | { type: 'NEXT_ROUND'; targetWord: string; round: SinglePlayerRound }
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
      currentRound.userRoundScore = action.scoreBreakdown.total;
      rounds[rounds.length - 1] = currentRound;

      const userScore = rounds.reduce((sum, r) => sum + r.userRoundScore, 0);

      return {
        ...state,
        loading: false,
        aiResult: action.result,
        game: {
          ...state.game,
          rounds,
          userScore,
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
      currentRound.userRoundScore = action.scoreBreakdown.total;
      rounds[rounds.length - 1] = currentRound;

      const userScore = rounds.reduce((sum, r) => sum + r.userRoundScore, 0);

      return {
        ...state,
        loading: false,
        guessFeedback: action.feedback,
        guessText: '',
        game: {
          ...state.game,
          rounds,
          userScore,
          status: 'round_end',
        },
      };
    }

    case 'NEXT_ROUND': {
      if (!state.game) return state;
      const newRound: SinglePlayerRound = action.round;
      return {
        ...state,
        loading: false,
        aiResult: null,
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

  // ─── Helpers ──────────────────────────────────

  const calculateScore = useCallback(
    (isCorrect: boolean, timeRemaining: number, confidence?: number, role: 'user_draws' | 'ai_draws' = 'user_draws'): ScoreBreakdown => {
      if (!isCorrect) {
        if (role === 'user_draws') {
          return { baseScore: 1, timeBonus: 0, confidenceBonus: 0, total: 1 };
        }
        return { baseScore: 0, timeBonus: 0, confidenceBonus: 0, total: 0 };
      }

      const baseScore = 10;
      const timeBonus = Math.min(Math.floor(timeRemaining * 0.1), 5);
      const confidenceBonus =
        role === 'user_draws' && confidence !== undefined
          ? Math.min(Math.floor(confidence * 5), 5)
          : 0;

      return {
        baseScore,
        timeBonus,
        confidenceBonus,
        total: baseScore + timeBonus + confidenceBonus,
      };
    },
    []
  );

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
      const breakdown = calculateScore(
        result.isCorrect,
        (state as SinglePlayerState).timeRemaining,
        result.matchedGuess?.confidence,
        'user_draws'
      );

      dispatch({ type: 'AI_RECOGNIZED', result, scoreBreakdown: breakdown });
    } catch (err) {
      dispatch({
        type: 'AI_RECOGNIZE_ERROR',
        error: err instanceof Error ? err.message : 'AI 识别失败',
      });
    }
  }, [state, stopTimer, calculateScore]);

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
      const breakdown = calculateScore(isCorrect, (state as SinglePlayerState).timeRemaining, undefined, 'ai_draws');

      dispatch({ type: 'GUESS_RESULT', isCorrect, feedback, scoreBreakdown: breakdown });
    },
    [state, stopTimer, calculateScore]
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
    setGuessText: (text: string) => dispatch({ type: 'SET_GUESS_TEXT', text }),
    clearError: () => dispatch({ type: 'CLEAR_ERROR' }),
  };
}
