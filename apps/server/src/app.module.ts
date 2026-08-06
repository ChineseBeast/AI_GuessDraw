import { Module } from '@nestjs/common';
import { RoomGateway } from './gateway/room.gateway';
import { RoomManagerService } from './services/room-manager.service';
import { GameEngineService } from './services/game-engine.service';
import { WordService } from './services/word.service';
import { SinglePlayerModule } from './modules/singleplayer/singleplayer.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [SinglePlayerModule, LeaderboardModule, AuthModule],
  controllers: [],
  providers: [RoomGateway, RoomManagerService, GameEngineService, WordService],
  exports: [RoomManagerService, GameEngineService, WordService],
})
export class AppModule {}
