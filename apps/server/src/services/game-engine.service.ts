import { Injectable } from '@nestjs/common';
import type { RoundEndReason } from '@draw-guess/shared';
import {
  SCORE_RULES,
  ROUND_DURATION,
  DRAWER_DISCONNECT_EXTRA_TIME,
} from '@draw-guess/shared';
import type { Room, GameState, RoundState, GuessRecord } from '../types/websocket.types';
import type { WordService } from './word.service';

@Injectable()
export class GameEngineService {
  private games = new Map<string, GameState>();

  /** 初始化游戏会话 */
  initGame(room: Room, wordService: WordService): GameState {
    const playerIds = [...room.players.keys()];
    const totalRounds = playerIds.length * 2;

    // 随机排列绘画者顺序
    const drawerOrder = this.shuffleArray([...playerIds]);

    // 预选词汇
    const wordPool = wordService.getRandomWords(room.difficulty, totalRounds);

    const game: GameState = {
      roomId: room.id,
      currentRound: 0,
      totalRounds,
      drawerOrder,
      currentDrawerIndex: 0,
      status: 'countdown',
      startedAt: new Date(),
      rounds: [],
      wordPool,
    };

    this.games.set(room.id, game);
    return game;
  }

  /** 获取游戏状态 */
  getGame(roomId: string): GameState | undefined {
    return this.games.get(roomId);
  }

  /** 开始新轮次 */
  startRound(
    game: GameState,
    wordService: WordService,
    roundDurationMs: number = ROUND_DURATION,
    onTimeout?: (game: GameState, round: RoundState) => void,
  ): RoundState {
    game.currentRound++;
    game.status = 'playing';

    const drawerId = game.drawerOrder[game.currentDrawerIndex % game.drawerOrder.length];
    const word = game.wordPool[game.currentRound - 1] || wordService.getRandomWord('medium');

    const round: RoundState = {
      roundNumber: game.currentRound,
      drawerId,
      targetWord: word.word,
      wordDifficulty: word.difficulty,
      startedAt: new Date(),
      guesses: [],
      strokes: [],
      status: 'active',
      durationMs: roundDurationMs,
    };

    // 设置超时（AI 绘画轮次由调用方传入更长的时长）；
    // onTimeout 由调用方（gateway）传入，用于广播轮次结束并推进下一轮
    round.timerHandle = setTimeout(() => {
      this.endRound(game, round, 'timeout');
      onTimeout?.(game, round);
    }, roundDurationMs);

    game.rounds.push(round);
    return round;
  }

  /** 结束当前轮次 */
  endRound(game: GameState, round: RoundState, endReason: RoundEndReason): void {
    if (round.status !== 'active') return;

    round.status = 'completed';
    round.endedAt = new Date();
    round.endReason = endReason;

    if (round.timerHandle) {
      clearTimeout(round.timerHandle);
      round.timerHandle = undefined;
    }

    game.status = 'round_end';
  }

  /** 处理猜词 */
  processGuess(
    game: GameState,
    round: RoundState,
    playerId: string,
    guessText: string,
    wordService: WordService,
  ): { guess: GuessRecord; guesserRank: number | null; allGuessed: boolean } {
    const { isCorrect, proximity } = wordService.checkGuess(guessText, round.targetWord);

    let score = 0;
    let guesserRank: number | null = null;

    if (isCorrect) {
      // 计算排名和分数
      const correctCount = round.guesses.filter(g => g.isCorrect).length;
      guesserRank = correctCount + 1;

      if (guesserRank === 1) score = SCORE_RULES.multiplayer.firstCorrect;
      else if (guesserRank === 2) score = SCORE_RULES.multiplayer.secondCorrect;
      else if (guesserRank === 3) score = SCORE_RULES.multiplayer.thirdCorrect;
      else score = 1; // 第4个及之后猜对得 1 分
    }

    const guess: GuessRecord = {
      playerId,
      text: guessText,
      isCorrect,
      proximity,
      score,
      submittedAt: new Date(),
    };

    round.guesses.push(guess);

    // 检查是否所有非绘画者都猜对了
    const allGuessed = this.checkAllGuessed(game, round);

    return { guess, guesserRank, allGuessed };
  }

  /**
   * 处理 AI 玩家猜词（联机模式）。
   * 与 processGuess 完全一致（计分/排名/全员猜对判定），
   * 区别仅在于正确性判定：AI 必须精确匹配目标词，不做模糊匹配。
   */
  processAIGuess(
    game: GameState,
    round: RoundState,
    playerId: string,
    guessText: string,
  ): { guess: GuessRecord; guesserRank: number | null; allGuessed: boolean } {
    const isCorrect = guessText.trim() === round.targetWord;
    const proximity: GuessRecord['proximity'] = isCorrect ? 'exact' : 'wrong';

    let score = 0;
    let guesserRank: number | null = null;

    if (isCorrect) {
      // 计算排名和分数
      const correctCount = round.guesses.filter(g => g.isCorrect).length;
      guesserRank = correctCount + 1;

      if (guesserRank === 1) score = SCORE_RULES.multiplayer.firstCorrect;
      else if (guesserRank === 2) score = SCORE_RULES.multiplayer.secondCorrect;
      else if (guesserRank === 3) score = SCORE_RULES.multiplayer.thirdCorrect;
      else score = 1; // 第4个及之后猜对得 1 分
    }

    const guess: GuessRecord = {
      playerId,
      text: guessText,
      isCorrect,
      proximity,
      score,
      submittedAt: new Date(),
    };

    round.guesses.push(guess);

    // 检查是否所有非绘画者都猜对了
    const allGuessed = this.checkAllGuessed(game, round);

    return { guess, guesserRank, allGuessed };
  }

  /** 计算绘画者得分 */
  calculateDrawerScore(round: RoundState): number {
    const correctGuesses = round.guesses.filter(g => g.isCorrect).length;
    return correctGuesses * SCORE_RULES.multiplayer.drawerPerCorrectGuess;
  }

  /** 推进到下一轮 */
  advanceToNextRound(game: GameState): boolean {
    game.currentDrawerIndex++;

    if (game.currentRound >= game.totalRounds) {
      game.status = 'game_end';
      return false; // 游戏结束
    }

    game.status = 'countdown';
    return true; // 还有下一轮
  }

  /** 计算最终排名 */
  getFinalScores(
    game: GameState,
    room: Room,
  ): { playerId: string; nickname: string; totalScore: number; rank: number }[] {
    const scores = new Map<string, number>();

    // 汇总所有轮次得分
    for (const round of game.rounds) {
      // 绘画者得分
      const drawerScore = this.calculateDrawerScore(round);
      scores.set(round.drawerId, (scores.get(round.drawerId) || 0) + drawerScore);

      // 猜词者得分
      for (const guess of round.guesses) {
        if (guess.isCorrect) {
          scores.set(guess.playerId, (scores.get(guess.playerId) || 0) + guess.score);
        }
      }
    }

    // 转换为排名数组
    const playerScores = [...room.players.values()]
      .map(p => ({
        playerId: p.userId,
        nickname: p.nickname,
        totalScore: scores.get(p.userId) || 0,
        rank: 0,
      }))
      .sort((a, b) => b.totalScore - a.totalScore);

    // 分配排名（同分同名）
    playerScores.forEach((ps, i) => {
      if (i > 0 && ps.totalScore === playerScores[i - 1].totalScore) {
        ps.rank = playerScores[i - 1].rank;
      } else {
        ps.rank = i + 1;
      }
    });

    return playerScores;
  }

  /** 切换绘画者（用于断线场景） */
  switchDrawer(game: GameState, round: RoundState, newDrawerId: string, onTimeout?: (game: GameState, round: RoundState) => void): void {
    round.drawerId = newDrawerId;

    // 延长计时器
    if (round.timerHandle) {
      clearTimeout(round.timerHandle);
    }
    round.durationMs = ROUND_DURATION + DRAWER_DISCONNECT_EXTRA_TIME;
    round.timerHandle = setTimeout(() => {
      this.endRound(game, round, 'timeout');
      onTimeout?.(game, round);
    }, round.durationMs);
  }

  /** 清理游戏 */
  removeGame(roomId: string): void {
    const game = this.games.get(roomId);
    if (game) {
      for (const round of game.rounds) {
        if (round.timerHandle) {
          clearTimeout(round.timerHandle);
        }
      }
    }
    this.games.delete(roomId);
  }

  // ─── Private ─────────────────────────────────────

  private checkAllGuessed(game: GameState, round: RoundState): boolean {
    const guesserIds = game.drawerOrder.filter(id => id !== round.drawerId);
    const correctGuessers = new Set(round.guesses.filter(g => g.isCorrect).map(g => g.playerId));
    return guesserIds.every(id => correctGuessers.has(id));
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
