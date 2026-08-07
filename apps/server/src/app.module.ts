import { Module } from '@nestjs/common';
import { RoomGateway } from './gateway/room.gateway';
import { RoomManagerModule } from './services/room-manager.module';
import { WordModule } from './services/word.module';
import { GameEngineService } from './services/game-engine.service';
import { SinglePlayerModule } from './modules/singleplayer/singleplayer.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [SinglePlayerModule, LeaderboardModule, AuthModule, AdminModule, RoomManagerModule, WordModule],
  controllers: [],
  providers: [RoomGateway, GameEngineService],
  exports: [GameEngineService],
})
export class AppModule {}
