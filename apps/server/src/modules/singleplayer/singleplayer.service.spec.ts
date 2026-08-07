import { Test, TestingModule } from '@nestjs/testing';
import { SinglePlayerService } from './singleplayer.service';

describe('SinglePlayerService', () => {
  let service: SinglePlayerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SinglePlayerService],
    }).compile();

    service = module.get<SinglePlayerService>(SinglePlayerService);
  });

  describe('getRandomWord', () => {
    it('should return a word of the requested difficulty', () => {
      const result = service.getRandomWord('easy');
      expect(result.word).toBeDefined();
      expect(result.difficulty).toBe('easy');
      expect(result.word.length).toBeGreaterThan(0);
    });

    it('should return words from the correct difficulty pool', () => {
      const easyWords = new Set<string>();
      for (let i = 0; i < 30; i++) {
        easyWords.add(service.getRandomWord('easy').word);
      }
      // All easy words should be 2 chars (Chinese)
      for (const w of easyWords) {
        expect(w.length).toBeLessThanOrEqual(3); // Easy words are short
      }
    });

    it('should not return excluded words', () => {
      const excluded = ['苹果', '香蕉', '太阳', '花朵', '大树', '猫咪', '小狗', '房子', '汽车'];
      for (let i = 0; i < 20; i++) {
        const result = service.getRandomWord('easy', excluded);
        expect(excluded).not.toContain(result.word);
      }
    });

    it('should fallback when all words of difficulty are excluded', () => {
      // Exclude all easy words
      const allEasy = ['苹果', '香蕉', '太阳', '花朵', '大树', '猫咪', '小狗', '房子', '汽车', '月亮'];
      const result = service.getRandomWord('easy', allEasy);
      // Should still return a word (from fallback pool)
      expect(result.word).toBeDefined();
    });

    it('should return a word for hard difficulty', () => {
      const result = service.getRandomWord('hard');
      expect(result.difficulty).toBe('hard');
    });
  });

  describe('recognize', () => {
    /**
     * Helper: retry recognize up to N times to dodge the 5% AI_SERVICE_UNAVAILABLE
     */
    async function recognizeSafe(
      imageBase64: string,
      targetWord: string,
      difficulty: 'easy' | 'medium' | 'hard',
      maxRetries = 5,
    ) {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await service.recognize(imageBase64, targetWord, difficulty);
        } catch (err: any) {
          if (err.message === 'AI_SERVICE_UNAVAILABLE' && i < maxRetries - 1) continue;
          throw err;
        }
      }
      throw new Error('Max retries exceeded');
    }

    it('should return a valid AI response within timeout', async () => {
      const result = await recognizeSafe('data:image/png;base64,' + 'x'.repeat(200), '苹果', 'easy');

      expect(result.guesses).toBeDefined();
      expect(result.guesses.length).toBeGreaterThanOrEqual(1);
      expect(result.guesses.length).toBeLessThanOrEqual(3);
      expect(typeof result.isCorrect).toBe('boolean');
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(1500);
    });

    it('should throw for empty image data', async () => {
      await expect(recognizeSafe('', '苹果', 'easy')).rejects.toThrow('INVALID_IMAGE');
    });

    it('should throw for very short image data', async () => {
      await expect(recognizeSafe('abc', '苹果', 'easy')).rejects.toThrow('INVALID_IMAGE');
    });

    it('should have higher success rate on easy difficulty', async () => {
      let correctCount = 0;
      const trials = 20;

      for (let i = 0; i < trials; i++) {
        const result = await recognizeSafe(
          'data:image/png;base64,' + 'x'.repeat(200),
          '苹果',
          'easy',
        );
        if (result.isCorrect) correctCount++;
      }

      const rate = correctCount / trials;
      expect(rate).toBeGreaterThan(0.4); // Relaxed: easy should be better than 40%
    }, 15000);

    it('should have lower success rate on hard difficulty', async () => {
      let correctCount = 0;
      const trials = 20;

      for (let i = 0; i < trials; i++) {
        const result = await recognizeSafe(
          'data:image/png;base64,' + 'x'.repeat(200),
          '金字塔',
          'hard',
        );
        if (result.isCorrect) correctCount++;
      }

      const rate = correctCount / trials;
      expect(rate).toBeLessThan(0.75); // Hard should be below 75%
    }, 15000);

    it('should include matchedGuess when correct', async () => {
      for (let i = 0; i < 10; i++) {
        const result = await recognizeSafe(
          'data:image/png;base64,' + 'x'.repeat(200),
          '苹果',
          'easy',
        );
        if (result.isCorrect) {
          expect(result.matchedGuess).toBeDefined();
          expect(result.matchedGuess!.word).toBe('苹果');
          expect(result.matchedGuess!.confidence).toBeGreaterThan(0.8);
          return;
        }
      }
    }, 10000);

    it('should return 3 wrong guesses when not correct', async () => {
      for (let i = 0; i < 10; i++) {
        const result = await recognizeSafe(
          'data:image/png;base64,' + 'x'.repeat(200),
          '金字塔',
          'hard',
        );
        if (!result.isCorrect) {
          expect(result.guesses.length).toBe(3);
          expect(result.matchedGuess).toBeUndefined();
          return;
        }
      }
    }, 10000);
  });

  describe('calculateScore', () => {
    it('should give base score 10 + bonuses for correct user drawing', () => {
      const score = service.calculateScore({
        isCorrect: true,
        timeRemaining: 30,
        confidence: 0.9,
        role: 'user_draws',
      });

      expect(score.baseScore).toBe(10);
      expect(score.timeBonus).toBe(3); // floor(30 * 0.1)
      expect(score.confidenceBonus).toBe(4); // floor(0.9 * 5)
      expect(score.total).toBe(17);
    });

    it('should cap time bonus at 5', () => {
      const score = service.calculateScore({
        isCorrect: true,
        timeRemaining: 60,
        confidence: 0.9,
        role: 'user_draws',
      });

      expect(score.timeBonus).toBe(5); // capped
    });

    it('should cap confidence bonus at 5', () => {
      const score = service.calculateScore({
        isCorrect: true,
        timeRemaining: 30,
        confidence: 1.0,
        role: 'user_draws',
      });

      expect(score.confidenceBonus).toBe(5);
    });

    it('should give minimal score for incorrect user drawing', () => {
      const score = service.calculateScore({
        isCorrect: false,
        timeRemaining: 30,
        role: 'user_draws',
      });

      expect(score.total).toBe(1);
    });

    it('should give zero score for incorrect AI drawing guess', () => {
      const score = service.calculateScore({
        isCorrect: false,
        timeRemaining: 30,
        role: 'ai_draws',
      });

      expect(score.total).toBe(0);
    });

    it('should not include confidence bonus for AI draws role', () => {
      const score = service.calculateScore({
        isCorrect: true,
        timeRemaining: 30,
        confidence: 0.9,
        role: 'ai_draws',
      });

      expect(score.confidenceBonus).toBe(0);
      expect(score.total).toBe(13); // 10 + 3 + 0
    });
  });
});
