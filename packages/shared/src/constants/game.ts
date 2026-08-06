import type { GameMode, Difficulty, Provider } from '../types/game.js';

/** 游戏模式列表 */
export const GAME_MODES: { mode: GameMode; label: string; description: string }[] = [
  { mode: 'single', label: '单机模式', description: '与 AI 进行 1v1 对战' },
  { mode: 'multiplayer', label: '联机模式', description: '与好友实时对战' },
  { mode: 'story', label: '故事模式', description: 'AI 叙事绘画冒险' },
];

/** 最大玩家数 */
export const MAX_PLAYERS = {
  min: 2,
  max: 8,
  default: 4,
} as const;

/** 回合时间（秒） */
export const ROUND_TIMES = {
  drawing: 60,
  guessing: 30,
  countdown: 3,
  result: 10,
} as const;

/** 难度级别 */
export const DIFFICULTY_LEVELS: { level: Difficulty; label: string; description: string }[] = [
  { level: 'easy', label: '简单', description: '常见词汇，AI 识别宽松' },
  { level: 'medium', label: '中等', description: '一般词汇，AI 识别正常' },
  { level: 'hard', label: '困难', description: '生僻词汇，AI 识别严格' },
];

/** AI 模型选项（单机模式选择页用） */
export const PROVIDER_LEVELS: { level: Provider; label: string; description: string }[] = [
  { level: 'minimax', label: 'MiniMax', description: '画作更逼真，识别快（推荐）' },
  { level: 'qwen', label: '通义千问', description: '笔画简洁，响应稳定' },
];

/** 分数规则 */
export const SCORE_RULES = {
  correctGuess: 10,
  timeBonus: { max: 5, perSecondRemaining: 0.1 },
  aiConfidenceBonus: { max: 5 },
  // 联机模式计分
  multiplayer: {
    firstCorrect: 15,
    secondCorrect: 10,
    thirdCorrect: 5,
    drawerPerCorrectGuess: 5,
  },
  // 单机模式计分（保持兼容）
  firstCorrectBonus: 5,
  secondCorrectBonus: 3,
  thirdCorrectBonus: 0,
  drawerPerCorrectGuess: 5,
} as const;

/** 邀请码长度 */
export const INVITE_CODE_LENGTH = 6;

/** 最大重连时间（秒） */
export const MAX_RECONNECT_TIME = 30;

/** 房间清理超时（毫秒） */
export const ROOM_CLEANUP_TIMEOUT = 5 * 60 * 1000; // 5 分钟

/** 回合时间（毫秒） */
export const ROUND_DURATION = 60_000; // 60 秒

/** 倒计时时间（毫秒） */
export const COUNTDOWN_DURATION = 3_000; // 3 秒

/** 轮次结果展示时间（毫秒） */
export const ROUND_RESULT_DURATION = 3_000; // 3 秒

/** 绘画者断线后额外时间（毫秒） */
export const DRAWER_DISCONNECT_EXTRA_TIME = 10_000; // 10 秒

/** 邀请码字符集（排除 0/O/1/I/L） */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
