import { useState, useCallback, useEffect } from 'react';
import type {
  GameStartedEvent,
  RoundStartedForDrawer,
  RoundStartedForGuessers,
  GuessResultEvent,
  CorrectGuessEvent,
  RoundEndedEvent,
  GameEndedEvent,
} from '@draw-guess/shared';

interface GameState {
  status: 'waiting' | 'countdown' | 'playing' | 'round_end' | 'game_end';
  currentRound: number;
  totalRounds: number;
  targetWord?: string;
  wordLength?: number;
  wordHint?: string;
  timeLimit: number;
  drawerId?: string;
  scores: Record<string, number>;
  guessResult?: GuessResultEvent;
  correctGuesses: CorrectGuessEvent[];
  roundEnded?: RoundEndedEvent;
  gameEnded?: GameEndedEvent;
}

interface UseGameOptions {
  on: <T>(event: string, handler: (data: T) => void) => () => void;
  emit: (event: string, payload?: Record<string, unknown>) => void;
  gameInit?: GameStartedEvent;
}

export function useGame({ on, emit, gameInit }: UseGameOptions) {
  const [game, setGame] = useState<GameState>({
    status: gameInit ? 'countdown' : 'waiting',
    currentRound: 0,
    totalRounds: gameInit?.totalRounds ?? 0,
    timeLimit: 60,
    scores: {},
    correctGuesses: [],
  });

  useEffect(() => {
    const unsub1 = on<GameStartedEvent>('game_started', (data) => {
      setGame(prev => ({
        ...prev,
        status: 'countdown',
        totalRounds: data.totalRounds,
      }));
    });

    const unsub2 = on<RoundStartedForDrawer | RoundStartedForGuessers>('round_started', (data) => {
      if ('targetWord' in data) {
        setGame(prev => ({
          ...prev,
          status: 'playing',
          currentRound: data.roundNumber,
          targetWord: data.targetWord,
          timeLimit: data.timeLimit,
          guessResult: undefined,
          correctGuesses: [],
        }));
      } else {
        setGame(prev => ({
          ...prev,
          status: 'playing',
          currentRound: data.roundNumber,
          wordLength: data.wordLength,
          wordHint: data.wordHint,
          targetWord: undefined,
          timeLimit: data.timeLimit,
          guessResult: undefined,
          correctGuesses: [],
        }));
      }
    });

    const unsub3 = on<GuessResultEvent>('guess_result', (data) => {
      setGame(prev => ({ ...prev, guessResult: data }));
    });

    const unsub4 = on<CorrectGuessEvent>('correct_guess', (data) => {
      setGame(prev => ({
        ...prev,
        correctGuesses: [...prev.correctGuesses, data],
      }));
    });

    const unsub5 = on<RoundEndedEvent>('round_ended', (data) => {
      setGame(prev => ({
        ...prev,
        status: 'round_end',
        scores: data.totalScores,
        roundEnded: data,
      }));
    });

    const unsub6 = on<GameEndedEvent>('game_ended', (data) => {
      setGame(prev => ({
        ...prev,
        status: 'game_end',
        gameEnded: data,
      }));
    });

    return () => {
      unsub1(); unsub2(); unsub3();
      unsub4(); unsub5(); unsub6();
    };
  }, [on]);

  const submitGuess = useCallback((text: string) => {
    emit('submit_guess', { text } as unknown as Record<string, unknown>);
  }, [emit]);

  const isDrawer = game.targetWord !== undefined;

  return { game, submitGuess, isDrawer };
}
