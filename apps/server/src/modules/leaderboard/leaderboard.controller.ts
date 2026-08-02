import { Controller, Get, Post, Body, Query, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import type { LeaderboardService } from './leaderboard.service';
import type { LeaderboardPeriod } from '@draw-guess/shared';

interface LeaderboardQueryDto {
  period?: string;
  limit?: string;
  offset?: string;
}

interface SubmitResultDto {
  playerId: string;
  nickname: string;
  score: number;
  won: boolean;
}

@Controller('api/leaderboard')
export class LeaderboardController {
  constructor(private readonly service: LeaderboardService) {}

  @Get()
  @HttpCode(200)
  getLeaderboard(@Query() query: LeaderboardQueryDto) {
    const period = this.validatePeriod(query.period ?? 'all');
    const limit = Math.min(Math.max(parseInt(query.limit ?? '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(query.offset ?? '0', 10) || 0, 0);

    return this.service.getLeaderboard(period, limit, offset);
  }

  @Post('submit')
  @HttpCode(201)
  submitResult(@Body() dto: SubmitResultDto) {
    if (!dto.playerId || !dto.nickname || dto.score === undefined) {
      throw new HttpException(
        { error: 'INVALID_REQUEST', message: '缺少必填参数: playerId, nickname, score' },
        HttpStatus.BAD_REQUEST,
      );
    }

    this.service.submitResult({
      playerId: dto.playerId,
      nickname: dto.nickname,
      score: dto.score,
      won: dto.won ?? false,
    });

    return { status: 'ok' };
  }

  private validatePeriod(period: string): LeaderboardPeriod {
    if (period === 'weekly' || period === 'monthly' || period === 'all') {
      return period;
    }
    return 'all';
  }
}
