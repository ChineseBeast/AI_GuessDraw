import { Injectable } from '@nestjs/common';
import type { Difficulty } from '@draw-guess/shared';
import type { AIGuess, AIRecognizeResponse } from './singleplayer.types';

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

// 相似词映射（用于 mock 返回"接近"的猜测）
const SIMILAR_WORDS: Record<string, string[]> = {
  '苹果': ['水果', '番茄', '樱桃'],
  '香蕉': ['水果', '黄瓜', '月牙'],
  '太阳': ['月亮', '星星', '灯泡'],
  '花朵': ['小草', '树叶', '蝴蝶'],
  '大树': ['森林', '灌木', '树苗'],
  '猫咪': ['小狗', '老虎', '兔子'],
  '小狗': ['猫咪', '狼', '狐狸'],
  '房子': ['城堡', '小屋', '建筑'],
  '汽车': ['卡车', '巴士', '轿车'],
  '月亮': ['太阳', '星星', '圆盘'],
  '大象': ['犀牛', '河马', '长颈鹿'],
  '飞机': ['火箭', '直升机', '飞鸟'],
  '草莓': ['樱桃', '番茄', '葡萄'],
  '闹钟': ['手表', '时钟', '铃铛'],
  '雨伞': ['阳伞', '蘑菇', '帽子'],
  '眼镜': ['墨镜', '望远镜', '放大镜'],
  '吉他': ['提琴', '琵琶', '二胡'],
  '火箭': ['飞机', '导弹', '飞船'],
  '篮球': ['足球', '排球', '乒乓球'],
  '蛋糕': ['面包', '饼干', '甜点'],
  '直升机': ['飞机', '蜻蜓', '风车'],
  '长颈鹿': ['大象', '鸵鸟', '斑马'],
  '望远镜': ['显微镜', '眼镜', '万花筒'],
  '金字塔': ['三角形', '山峰', '帐篷'],
  '向日葵': ['菊花', '太阳', '风车'],
  '北极熊': ['企鹅', '白熊', '熊猫'],
  '消防车': ['卡车', '救护车', '警车'],
  '摩天轮': ['风车', '车轮', '旋转木马'],
  '潜水艇': ['鲸鱼', '轮船', '鱼雷'],
  '恐龙': ['蜥蜴', '鳄鱼', '怪兽'],
};

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
   * Mock AI 识别
   *
   * 模拟策略：
   * - easy: 80% 正确率
   * - medium: 60% 正确率
   * - hard: 40% 正确率
   * - 延迟: 200-800ms
   */
  async recognize(
    imageBase64: string,
    targetWord: string,
    difficulty: Difficulty
  ): Promise<AIRecognizeResponse> {
    // 模拟处理延迟
    const delay = 200 + Math.random() * 600;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // 5% 概率模拟服务不可用
    if (Math.random() < 0.05) {
      throw new Error('AI_SERVICE_UNAVAILABLE');
    }

    // 验证图片不为空
    if (!imageBase64 || imageBase64.length < 100) {
      throw new Error('INVALID_IMAGE');
    }

    const successRates: Record<Difficulty, number> = {
      easy: 0.8,
      medium: 0.6,
      hard: 0.4,
    };

    const success = Math.random() < successRates[difficulty];

    if (success) {
      const confidence = 0.85 + Math.random() * 0.14;
      const similarWords = SIMILAR_WORDS[targetWord] || ['东西', '物体', '形状'];

      return {
        guesses: [
          { word: targetWord, confidence: parseFloat(confidence.toFixed(2)) },
          { word: similarWords[0], confidence: parseFloat((0.6 + Math.random() * 0.3).toFixed(2)) },
          { word: similarWords[1] || '东西', confidence: parseFloat((0.3 + Math.random() * 0.3).toFixed(2)) },
        ],
        isCorrect: true,
        matchedGuess: {
          word: targetWord,
          confidence: parseFloat(confidence.toFixed(2)),
        },
        processingTime: Math.round(delay),
      };
    }

    // 猜错：返回随机不匹配的词
    const wrongPool = WORDS.filter((w) => w.word !== targetWord);
    const wrongGuesses: AIGuess[] = [];
    const usedWords = new Set<string>();

    for (let i = 0; i < 3; i++) {
      const candidates = wrongPool.filter((w) => !usedWords.has(w.word));
      if (candidates.length === 0) break;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      usedWords.add(pick.word);
      wrongGuesses.push({
        word: pick.word,
        confidence: parseFloat((0.3 + Math.random() * 0.4).toFixed(2)),
      });
    }

    return {
      guesses: wrongGuesses,
      isCorrect: false,
      processingTime: Math.round(delay),
    };
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
