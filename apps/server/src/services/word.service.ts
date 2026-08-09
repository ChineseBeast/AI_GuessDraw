import type { OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Difficulty } from '@draw-guess/shared';
import type { WordEntry } from '../types/websocket.types';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WordService implements OnModuleInit {
  private words: Record<string, string[]> = { easy: [], medium: [], hard: [] };

  onModuleInit(): void {
    this.loadWords();
  }

  /** 随机获取一个词汇 */
  getRandomWord(difficulty: Difficulty): WordEntry {
    const pool = this.words[difficulty] || this.words['medium'];
    if (pool.length === 0) {
      return { word: '苹果', difficulty: 'easy' };
    }
    const index = Math.floor(Math.random() * pool.length);
    return { word: pool[index], difficulty };
  }

  /** 获取指定数量的词汇（不重复） */
  getRandomWords(difficulty: Difficulty, count: number): WordEntry[] {
    const pool = [...(this.words[difficulty] || this.words['medium'])];
    const result: WordEntry[] = [];

    // Fisher-Yates shuffle + pick
    for (let i = 0; i < Math.min(count, pool.length); i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
      result.push({ word: pool[i], difficulty });
    }

    return result;
  }

  /** 检查猜词是否匹配 */
  checkGuess(guess: string, targetWord: string): {
    isCorrect: boolean;
    proximity: 'exact' | 'close' | 'length_match' | 'wrong';
  } {
    const normalizedGuess = guess.trim();
    const normalizedTarget = targetWord.trim();

    // 精确匹配
    if (normalizedGuess === normalizedTarget) {
      return { isCorrect: true, proximity: 'exact' };
    }

    // 编辑距离 ≤ 1（允许一个错字/多字/少字）
    const distance = this.levenshteinDistance(normalizedGuess, normalizedTarget);
    if (distance <= 1) {
      return { isCorrect: false, proximity: 'close' };
    }

    // 长度匹配
    if (normalizedGuess.length === normalizedTarget.length) {
      return { isCorrect: false, proximity: 'length_match' };
    }

    return { isCorrect: false, proximity: 'wrong' };
  }

  // ─── 管理接口 ─────────────────────────────────────

  /** 获取所有词库（管理用） */
  getAllWords(): { easy: string[]; medium: string[]; hard: string[] } {
    return {
      easy: [...this.words.easy],
      medium: [...this.words.medium],
      hard: [...this.words.hard],
    };
  }

  /** 添加词汇到指定难度 */
  addWord(difficulty: Difficulty, word: string): void {
    const trimmed = word.trim();
    if (!trimmed) {
      throw new Error('词汇不能为空');
    }
    const pool = this.words[difficulty];
    if (!pool) {
      throw new Error(`无效难度: ${difficulty}`);
    }
    if (!pool.includes(trimmed)) {
      pool.push(trimmed);
    }
  }

  /** 批量添加词汇 */
  addWords(difficulty: Difficulty, words: string[]): { added: number; skipped: number } {
    const pool = this.words[difficulty];
    if (!pool) {
      throw new Error(`无效难度: ${difficulty}`);
    }
    let added = 0;
    let skipped = 0;
    for (const w of words) {
      const trimmed = w.trim();
      if (!trimmed) {
        skipped++;
        continue;
      }
      if (!pool.includes(trimmed)) {
        pool.push(trimmed);
        added++;
      } else {
        skipped++;
      }
    }
    return { added, skipped };
  }

  /** 删除指定词汇 */
  removeWord(difficulty: Difficulty, word: string): boolean {
    const pool = this.words[difficulty];
    if (!pool) return false;
    const index = pool.indexOf(word.trim());
    if (index === -1) return false;
    pool.splice(index, 1);
    return true;
  }

  // ─── Private ─────────────────────────────────────

  private loadWords(): void {
    try {
      const filePath = path.resolve(__dirname, '../data/words.json');
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.words = {
        easy: parsed.easy || [],
        medium: parsed.medium || [],
        hard: parsed.hard || [],
      };
    } catch {
      // Fallback: use built-in words
      this.words = {
        easy: ['苹果', '太阳', '房子', '猫咪', '星星'],
        medium: ['自行车', '金字塔', '彩虹', '恐龙', '火箭'],
        hard: ['蒙娜丽莎', '自由女神像', '黑洞', '丝绸之路', '兵马俑'],
      };
    }
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    return matrix[a.length][b.length];
  }
}
