import type { AIRecognizeResponse, AIDrawResponse, Difficulty } from '@draw-guess/shared';

const API_BASE = '/api/singleplayer';

/**
 * AI 识别服务客户端
 */
export const AIService = {
  /**
   * 获取随机目标词
   */
  async getWord(difficulty: Difficulty, excludeWords: string[] = []): Promise<{ word: string; difficulty: Difficulty }> {
    const res = await fetch(`${API_BASE}/word`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty, excludeWords }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Network error' }));
      throw new Error(err.message || '获取词汇失败');
    }

    return res.json();
  },

  /**
   * AI 识别画作
   */
  async recognize(
    image: string,
    targetWord: string,
    difficulty: Difficulty
  ): Promise<AIRecognizeResponse> {
    const res = await fetch(`${API_BASE}/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, targetWord, difficulty }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Network error' }));
      throw new Error(err.message || 'AI 识别失败');
    }

    return res.json();
  },

  /**
   * AI 生成绘画（笔画轨迹），前端在 Canvas 上重现绘制
   */
  async generateDrawing(targetWord: string, difficulty: Difficulty): Promise<AIDrawResponse> {
    const res = await fetch(`${API_BASE}/generate-drawing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetWord, difficulty }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Network error' }));
      throw new Error(err.message || 'AI 绘画生成失败');
    }

    return res.json();
  },
};
