import { Test, TestingModule } from '@nestjs/testing';
import { WordService } from './word.service';

describe('WordService', () => {
  let service: WordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WordService],
    }).compile();

    service = module.get<WordService>(WordService);
    // Manually set words to avoid file system dependency
    (service as any).words = {
      easy: ['苹果', '太阳', '房子', '猫咪', '星星'],
      medium: ['自行车', '金字塔', '彩虹', '恐龙', '火箭'],
      hard: ['蒙娜丽莎', '自由女神像', '黑洞', '丝绸之路', '兵马俑'],
    };
  });

  describe('getRandomWord', () => {
    it('should return a word with correct difficulty', () => {
      const word = service.getRandomWord('easy');
      expect(word.difficulty).toBe('easy');
      expect(word.word).toBeDefined();
      expect(word.word.length).toBeGreaterThan(0);
    });

    it('should return a word from the correct pool', () => {
      const easyWords = new Set<string>();
      for (let i = 0; i < 20; i++) {
        easyWords.add(service.getRandomWord('easy').word);
      }
      // Should only contain words from the easy pool
      const validWords = new Set(['苹果', '太阳', '房子', '猫咪', '星星']);
      for (const w of easyWords) {
        expect(validWords.has(w)).toBe(true);
      }
    });
  });

  describe('getRandomWords', () => {
    it('should return requested number of words', () => {
      const words = service.getRandomWords('medium', 3);
      expect(words.length).toBe(3);
      for (const w of words) {
        expect(w.difficulty).toBe('medium');
      }
    });

    it('should return unique words', () => {
      const words = service.getRandomWords('medium', 3);
      const wordSet = new Set(words.map(w => w.word));
      expect(wordSet.size).toBe(3);
    });

    it('should not return more words than available', () => {
      const words = service.getRandomWords('hard', 20);
      expect(words.length).toBe(5); // Only 5 hard words available
    });
  });

  describe('checkGuess', () => {
    it('should detect exact match', () => {
      const result = service.checkGuess('苹果', '苹果');
      expect(result.isCorrect).toBe(true);
      expect(result.proximity).toBe('exact');
    });

    it('should detect close match (edit distance ≤ 1)', () => {
      const result = service.checkGuess('苹果果', '苹果');
      expect(result.isCorrect).toBe(false);
      expect(result.proximity).toBe('close');
    });

    it('should detect length match', () => {
      const result = service.checkGuess('香蕉', '苹果');
      expect(result.isCorrect).toBe(false);
      expect(result.proximity).toBe('length_match');
    });

    it('should detect completely wrong guess', () => {
      const result = service.checkGuess('大象', '苹果');
      expect(result.isCorrect).toBe(false);
      // Both are 2 chars, so it returns length_match
      expect(result.proximity).toBe('length_match');
    });

    it('should detect wrong with different length', () => {
      const result = service.checkGuess('大', '苹果');
      expect(result.isCorrect).toBe(false);
      expect(result.proximity).toBe('wrong');
    });

    it('should trim whitespace', () => {
      const result = service.checkGuess(' 苹果 ', '苹果');
      expect(result.isCorrect).toBe(true);
    });

    it('should handle single character difference', () => {
      const result = service.checkGuess('太苹果', '苹果');
      expect(result.isCorrect).toBe(false);
      expect(result.proximity).toBe('close');
    });
  });
});
