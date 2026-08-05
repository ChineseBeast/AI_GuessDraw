import { Injectable } from '@nestjs/common';
import process from 'node:process';
import type { Difficulty } from '@draw-guess/shared';
import type { AIRecognizeResponse } from './singleplayer.types';

interface WordEntry {
  word: string;
  difficulty: Difficulty;
}

// 内置词库（与 word.service.ts 共享数据源）
const WORDS: WordEntry[] = [
  // Easy
  { word: '苹果', difficulty: 'easy' },
  { word: '香蕉', difficulty: 'easy' },
  { word: '太阳', difficulty: 'easy' },
  { word: '花朵', difficulty: 'easy' },
  { word: '大树', difficulty: 'easy' },
  { word: '猫咪', difficulty: 'easy' },
  { word: '小狗', difficulty: 'easy' },
  { word: '房子', difficulty: 'easy' },
  { word: '汽车', difficulty: 'easy' },
  { word: '月亮', difficulty: 'easy' },
  // Medium
  { word: '大象', difficulty: 'medium' },
  { word: '飞机', difficulty: 'medium' },
  { word: '草莓', difficulty: 'medium' },
  { word: '闹钟', difficulty: 'medium' },
  { word: '雨伞', difficulty: 'medium' },
  { word: '眼镜', difficulty: 'medium' },
  { word: '吉他', difficulty: 'medium' },
  { word: '火箭', difficulty: 'medium' },
  { word: '篮球', difficulty: 'medium' },
  { word: '蛋糕', difficulty: 'medium' },
  // Hard
  { word: '直升机', difficulty: 'hard' },
  { word: '长颈鹿', difficulty: 'hard' },
  { word: '望远镜', difficulty: 'hard' },
  { word: '金字塔', difficulty: 'hard' },
  { word: '向日葵', difficulty: 'hard' },
  { word: '北极熊', difficulty: 'hard' },
  { word: '消防车', difficulty: 'hard' },
  { word: '摩天轮', difficulty: 'hard' },
  { word: '潜水艇', difficulty: 'hard' },
  { word: '恐龙', difficulty: 'hard' },
];

/** ai-service 基础地址，默认本地开发地址 */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, '') || 'http://localhost:8000';

/** ai-service recognize 路由 */
const AI_RECOGNIZE_ENDPOINT = `${AI_SERVICE_URL}/api/v1/ai/recognize`;

/** ai-service generate-drawing 路由 */
const AI_GENERATE_DRAWING_ENDPOINT = `${AI_SERVICE_URL}/api/v1/ai/generate-drawing`;

/** 调用 ai-service 的超时时间（ms）：千问 flash 识别/绘画最坏 60s + 兜底余量 */
const AI_SERVICE_TIMEOUT_MS = 75_000;

/** ai-service 错误响应体结构（FastAPI HTTPException detail） */
interface AIServiceErrorBody {
  detail?: { error?: string; message?: string } | string;
}

@Injectable()
export class SinglePlayerService {
  /**
   * 获取随机目标词
   */
  getRandomWord(difficulty: Difficulty, excludeWords: string[] = []): WordEntry {
    const pool = WORDS.filter(
      (w) => w.difficulty === difficulty && !excludeWords.includes(w.word)
    );

    if (pool.length === 0) {
      // fallback: 从所有词中选（排除已用词）
      const fallbackPool = WORDS.filter((w) => !excludeWords.includes(w.word));
      if (fallbackPool.length === 0) {
        return WORDS[0];
      }
      return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * AI 识别画作
   *
   * 通过 HTTP 调用 ai-service（FastAPI），由 ai-service 调用 minimax-m3 多模态模型识别图片。
   * ai-service 不可用（网络错误/超时/503）时抛出 AI_SERVICE_UNAVAILABLE，
   * 由 controller 转换为 HTTP 503 友好错误。
   */
  async recognize(
    imageBase64: string,
    targetWord: string,
    difficulty: Difficulty
  ): Promise<AIRecognizeResponse> {
    // 验证图片不为空
    if (!imageBase64 || imageBase64.length < 100) {
      throw new Error('INVALID_IMAGE');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT_MS);

    try {
      const res = await fetch(AI_RECOGNIZE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, targetWord, difficulty }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // 解析 ai-service 返回的错误结构
        const body = (await res.json().catch(() => null)) as AIServiceErrorBody | null;
        const detail = body?.detail;
        const errorCode =
          typeof detail === 'object' && detail !== null ? detail.error : undefined;

        // ai-service 503 -> AI 服务不可用
        if (res.status === 503 || errorCode === 'AI_SERVICE_UNAVAILABLE') {
          throw new Error('AI_SERVICE_UNAVAILABLE');
        }
        // ai-service 400 且为图片无效
        if (errorCode === 'INVALID_IMAGE') {
          throw new Error('INVALID_IMAGE');
        }
        // 其他错误统一视为 AI 服务不可用，返回友好错误
        throw new Error('AI_SERVICE_UNAVAILABLE');
      }

      return (await res.json()) as AIRecognizeResponse;
    } catch (error) {
      // AbortError（超时）或网络错误 -> AI 服务不可用
      if (error instanceof Error) {
        if (error.message === 'AI_SERVICE_UNAVAILABLE' || error.message === 'INVALID_IMAGE') {
          throw error;
        }
        // fetch 网络失败 / abort
        throw new Error('AI_SERVICE_UNAVAILABLE');
      }
      throw new Error('AI_SERVICE_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * AI 绘画生成：调用 ai-service 根据目标词生成笔画轨迹（绘画行为）。
   * ai-service 不可用时抛出 AI_SERVICE_UNAVAILABLE。
   */
  async generateDrawing(targetWord: string, difficulty: Difficulty): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 75_000); // 千问 flash 绘画 ~22s，最坏 60s + 兜底余量

    try {
      const res = await fetch(AI_GENERATE_DRAWING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetWord, difficulty }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error('AI_SERVICE_UNAVAILABLE');
      }

      return await res.json();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'AI_SERVICE_UNAVAILABLE') {
          throw error;
        }
        throw new Error('AI_SERVICE_UNAVAILABLE');
      }
      throw new Error('AI_SERVICE_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 计算单轮得分
   */
  calculateScore(params: {
    isCorrect: boolean;
    timeRemaining: number;
    confidence?: number;
    role: 'user_draws' | 'ai_draws';
  }): { baseScore: number; timeBonus: number; confidenceBonus: number; total: number } {
    const { isCorrect, timeRemaining, confidence, role } = params;

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
  }
}
