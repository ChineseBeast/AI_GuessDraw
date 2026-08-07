/** 总轮次 */
export const TOTAL_ROUNDS = 5;

/** 每轮时间限制（秒） */
export const ROUND_TIME = 60;

/** 画布逻辑尺寸 */
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

/** 撤销栈最大深度 */
export const MAX_UNDO_STEPS = 50;

/** 基础得分 */
export const BASE_SCORE = 10;

/** 时间奖励系数（每秒） */
export const TIME_BONUS_RATE = 0.1;

/** 时间奖励上限 */
export const MAX_TIME_BONUS = 5;

/** 置信度奖励系数 */
export const CONFIDENCE_BONUS_RATE = 5;

/** 置信度奖励上限 */
export const MAX_CONFIDENCE_BONUS = 5;

/** 参与分（AI 未猜对时） */
export const PARTICIPATION_SCORE = 1;

/** 橡皮擦半径（px） */
export const ERASER_RADIUS = 10;

/** 笔触粗细预设 */
export const BRUSH_SIZES = {
  thin: 2,
  medium: 4,
  thick: 8,
} as const;

/** 倒计时警告阈值（秒） */
export const TIMER_WARNING_THRESHOLD = 10;

/** AI 识别超时（毫秒） */
export const AI_RECOGNIZE_TIMEOUT = 5000;
