import type { Difficulty } from './game.js';

/** 游戏阶段 */
export type GamePhase =
  | 'idle'
  | 'drawing'
  | 'ai_recognizing'
  | 'guessing'
  | 'round_end'
  | 'game_end';

/** 回合角色 */
export type RoundRole = 'user_draws' | 'ai_draws';

/** AI 猜测结果 */
export interface AIGuess {
  word: string;
  confidence: number; // 0-1
}

/** AI 识别请求 */
export interface AIRecognizeRequest {
  image: string; // Base64 PNG (含 data:image/png;base64, 前缀)
  targetWord: string;
  difficulty: Difficulty;
}

/** AI 识别响应 */
export interface AIRecognizeResponse {
  guesses: AIGuess[];
  isCorrect: boolean;
  matchedGuess?: AIGuess;
  processingTime: number;
}

/** 计分明细 */
export interface ScoreBreakdown {
  baseScore: number;
  timeBonus: number;
  confidenceBonus: number;
  total: number;
}

/** 单轮信息 */
export interface SinglePlayerRound {
  roundNumber: number;
  role: RoundRole;
  targetWord: string;
  wordDifficulty: Difficulty;
  timeLimit: number;
  timeRemaining: number;
  // 用户画 AI 猜
  userDrawing?: string;
  aiGuesses?: AIGuess[];
  userRoundScore: number;
  // AI 画 用户猜
  userGuesses?: string[];
  userGuessedCorrectly?: boolean;
  aiRoundScore: number;
}

/** 单机游戏会话 */
export interface SinglePlayerGame {
  id: string;
  status: GamePhase;
  currentRound: number;
  totalRounds: number;
  difficulty: Difficulty;
  rounds: SinglePlayerRound[];
  userScore: number;
  aiScore: number;
  startedAt: string;
}
