import { Module } from '@nestjs/common';
import { RoomManagerService } from './room-manager.service';

@Module({
  providers: [RoomManagerService],
  exports: [RoomManagerService],
})
export class RoomManagerModule {}
