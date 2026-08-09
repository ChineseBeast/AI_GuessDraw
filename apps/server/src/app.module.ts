import { Module } from '@nestjs/common';
import { RoomGateway } from './gateway/room.gateway';
import { RoomManagerModule } from './services/room-manager.module';
import { WordModule } from './services/word.module';
import { GameEngineService } from './services/game-engine.service';
import { AIPlayerService } from './services/ai-player.service';
import { SinglePlayerModule } from './modules/singleplayer/singleplayer.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { StoryModule } from './modules/story/story.module';

@Module({
  imports: [SinglePlayerModule, StoryModule, LeaderboardModule, AuthModule, AdminModule, RoomManagerModule, WordModule],
  controllers: [],
  providers: [RoomGateway, GameEngineService, AIPlayerService],
  exports: [GameEngineService, AIPlayerService],
})
export class AppModule {}
