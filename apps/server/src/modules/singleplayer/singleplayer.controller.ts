import { Controller, Post, Body, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import { SinglePlayerService } from './singleplayer.service';
import type { Difficulty } from '@draw-guess/shared';

interface RecognizeDto {
  image: string;
  targetWord: string;
  difficulty: Difficulty;
}

interface WordDto {
  difficulty: Difficulty;
  excludeWords?: string[];
}

@Controller('singleplayer')
export class SinglePlayerController {
  constructor(private readonly service: SinglePlayerService) {}

  @Post('word')
  @HttpCode(200)
  getWord(@Body() dto: WordDto) {
    const { difficulty, excludeWords = [] } = dto;

    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
      throw new HttpException(
        { error: 'INVALID_REQUEST', message: '缺少或无效的 difficulty 参数' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const word = this.service.getRandomWord(difficulty, excludeWords);
    return { word: word.word, difficulty: word.difficulty };
  }

  @Post('recognize')
  @HttpCode(200)
  async recognize(@Body() dto: RecognizeDto) {
    const { image, targetWord, difficulty } = dto;

    if (!image || !targetWord || !difficulty) {
      throw new HttpException(
        { error: 'INVALID_REQUEST', message: '缺少必填参数: image, targetWord, difficulty' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      throw new HttpException(
        { error: 'INVALID_REQUEST', message: '无效的 difficulty 参数' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 检查图片大小 (Base64 字符串超过 6.6MB ≈ 5MB 原始图片)
    if (image.length > 7_000_000) {
      throw new HttpException(
        { error: 'IMAGE_TOO_LARGE', message: '图片超过 5MB 限制' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.service.recognize(image, targetWord, difficulty);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message === 'AI_SERVICE_UNAVAILABLE') {
        throw new HttpException(
          { error: 'AI_SERVICE_UNAVAILABLE', message: 'AI 服务暂时不可用，请稍后重试' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      if (message === 'INVALID_IMAGE') {
        throw new HttpException(
          { error: 'INVALID_REQUEST', message: '图片数据无效' },
          HttpStatus.BAD_REQUEST,
        );
      }

      throw new HttpException(
        { error: 'INTERNAL_ERROR', message: '服务器内部错误' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
