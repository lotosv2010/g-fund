import { Module } from '@nestjs/common';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';
import { PositionsSyncService } from './positions-sync.service';

@Module({
  controllers: [PositionsController],
  providers: [PositionsService, PositionsSyncService],
})
export class PositionsModule {}
