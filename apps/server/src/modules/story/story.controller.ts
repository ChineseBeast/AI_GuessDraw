import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import type { Provider, StoryTheme } from '@draw-guess/shared';
import { StoryService } from './story.service';

interface StartStoryDto { theme: StoryTheme; provider?: Provider }
interface SubmitStoryDto { image: string; provider?: Provider }

@Controller('stories')
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Post('start')
  async start(@Body() dto: StartStoryDto) {
    try {
      return await this.storyService.start(dto.theme, dto.provider ?? 'qwen');
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post(':storyId/chapters/:chapter/submit')
  @HttpCode(200)
  async submit(
    @Param('storyId') storyId: string,
    @Param('chapter', ParseIntPipe) chapter: number,
    @Body() dto: SubmitStoryDto,
  ) {
    try {
      return await this.storyService.submit(storyId, chapter, dto.image, dto.provider ?? 'qwen');
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Get(':storyId/progress')
  getProgress(@Param('storyId') storyId: string) {
    try {
      return this.storyService.getProgress(storyId);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toHttpException(error: unknown): HttpException {
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    const status = code === 'STORY_NOT_FOUND' ? HttpStatus.NOT_FOUND
      : code === 'INVALID_IMAGE' || code === 'IMAGE_TOO_LARGE' || code === 'INVALID_THEME' ? HttpStatus.BAD_REQUEST
      : HttpStatus.CONFLICT;
    return new HttpException({ error: code, message: this.messageFor(code) }, status);
  }

  private messageFor(code: string): string {
    const messages: Record<string, string> = {
      INVALID_THEME: '不支持的故事主题',
      STORY_NOT_FOUND: '故事不存在或已过期',
      INVALID_IMAGE: '请先完成一幅画再提交',
      IMAGE_TOO_LARGE: '图片不能超过 5MB',
      INVALID_CHAPTER_ORDER: '请按顺序完成当前章节',
      CHAPTER_LOCKED: '该章节尚未解锁',
      CHAPTER_ALREADY_COMPLETED: '该章节已经提交过了',
      STORY_COMPLETED: '故事已经完成',
    };
    return messages[code] ?? '故事服务暂时不可用';
  }
}
