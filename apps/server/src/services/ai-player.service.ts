import { Injectable, Logger } from '@nestjs/common';
import process from 'node:process';
import type { Difficulty } from '@draw-guess/shared';
import type { CanvasSyncEvent } from '../types/websocket.types';

/** AI 玩家固定 userId（无真实 socket，行为由服务端驱动） */
export const AI_PLAYER_ID = 'ai_player';

/** AI 玩家昵称 */
export const AI_PLAYER_NICKNAME = 'AI 小画师';

/** AI 两次猜词之间的最小间隔（ms） */
export const AI_GUESS_INTERVAL_MS = 3_000;

/** AI 绘画轮次在基础时长上增加的缓冲（ms），覆盖 AI 生成笔画的最坏耗时 */
export const AI_DRAW_EXTRA_MS = 90_000;

/** 画布同步笔画 → ai-service 识别笔画（画布操作类型 + 颜色/宽度） */
export interface AICanvasStroke {
  type: 'draw' | 'erase' | 'undo' | 'clear';
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

/** ai-service 返回的笔画轨迹 */
export interface AIDrawStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

/** ai-service 返回的候选词 */
export interface AIGuess {
  word: string;
  confidence: number;
}

/** ai-service 基础地址，默认本地开发地址 */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, '') || 'http://localhost:8000';

/** ai-service 绘画路由 */
const AI_GENERATE_DRAWING_ENDPOINT = `${AI_SERVICE_URL}/api/v1/ai/generate-drawing`;

/** ai-service 笔画识别路由（联机 AI 猜词用） */
const AI_RECOGNIZE_STROKES_ENDPOINT = `${AI_SERVICE_URL}/api/v1/ai/recognize-strokes`;

/** 调用 ai-service 的超时时间（ms）：千问 flash 识别/绘画最坏 90s + 兜底余量 */
const AI_SERVICE_TIMEOUT_MS = 105_000;

/** AI 猜词使用的大模型 provider */
const AI_PROVIDER = process.env.MULTIPLAYER_AI_PROVIDER || 'qwen';

@Injectable()
export class AIPlayerService {
  private readonly logger = new Logger(AIPlayerService.name);

  /**
   * AI 作为画者：调用 ai-service 根据目标词生成笔画轨迹（绘画行为）。
   * ai-service 不可用时抛出 AI_SERVICE_UNAVAILABLE。
   */
  async generateStrokes(targetWord: string, difficulty: Difficulty): Promise<AIDrawStroke[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT_MS);

    try {
      const res = await fetch(AI_GENERATE_DRAWING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetWord, difficulty, provider: AI_PROVIDER }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error('AI_SERVICE_UNAVAILABLE');
      }

      const data = (await res.json()) as { strokes?: AIDrawStroke[] };
      if (!data.strokes || data.strokes.length === 0) {
        throw new Error('AI_SERVICE_UNAVAILABLE');
      }
      return data.strokes;
    } catch (error) {
      if (error instanceof Error && error.message === 'AI_SERVICE_UNAVAILABLE') {
        throw error;
      }
      throw new Error('AI_SERVICE_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * AI 作为猜者：把房间内的画布同步笔画发送给 ai-service，
   * 渲染成图片后识别，返回原始候选词列表（匹配判定由调用方精确执行）。
   * ai-service 不可用时抛出 AI_SERVICE_UNAVAILABLE。
   */
  async recognizeStrokes(
    strokes: CanvasSyncEvent[],
    targetWord: string,
    difficulty: Difficulty,
  ): Promise<AIGuess[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT_MS);

    try {
      const res = await fetch(AI_RECOGNIZE_STROKES_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strokes: this.mapStrokesForAI(strokes),
          targetWord,
          difficulty,
          provider: AI_PROVIDER,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error('AI_SERVICE_UNAVAILABLE');
      }

      const data = (await res.json()) as { guesses?: AIGuess[] };
      return data.guesses ?? [];
    } catch (error) {
      if (error instanceof Error && error.message === 'AI_SERVICE_UNAVAILABLE') {
        throw error;
      }
      this.logger.warn(`AI stroke recognition request failed: ${(error as Error).message}`);
      throw new Error('AI_SERVICE_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Private ─────────────────────────────────────

  /**
   * 把画布同步事件映射为 ai-service 识别笔画：
   * draw → 画笔颜色/宽度；erase → 白色；undo/clear 原样保留（渲染端还原画布状态）。
   */
  private mapStrokesForAI(strokes: CanvasSyncEvent[]): AICanvasStroke[] {
    return strokes.map((s) => {
      if (s.type === 'undo' || s.type === 'clear') {
        return { type: s.type, points: [], color: '#000000', width: 4 };
      }
      return {
        type: s.type === 'erase' ? 'erase' : 'draw',
        points: s.points ?? [],
        color: s.type === 'erase' ? '#ffffff' : s.brush?.color ?? '#000000',
        width: s.brush?.size ?? 4,
      };
    });
  }
}
