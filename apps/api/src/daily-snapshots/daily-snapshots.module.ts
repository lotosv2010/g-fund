import { Module } from '@nestjs/common';
import { DailySnapshotsController } from './daily-snapshots.controller';
import { DailySnapshotsService } from './daily-snapshots.service';

@Module({
  controllers: [DailySnapshotsController],
  providers: [DailySnapshotsService],
})
export class DailySnapshotsModule {}
