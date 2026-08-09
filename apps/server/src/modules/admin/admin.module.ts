import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { RoomManagerModule } from '../../services/room-manager.module';
import { WordModule } from '../../services/word.module';

@Module({
  imports: [AuthModule, LeaderboardModule, RoomManagerModule, WordModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
