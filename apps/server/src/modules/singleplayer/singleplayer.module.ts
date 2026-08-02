import { Module } from '@nestjs/common';
import { SinglePlayerController } from './singleplayer.controller';
import { SinglePlayerService } from './singleplayer.service';

@Module({
  controllers: [SinglePlayerController],
  providers: [SinglePlayerService],
  exports: [SinglePlayerService],
})
export class SinglePlayerModule {}
