import { Module } from '@nestjs/common';
import { StopLossTakeProfitController } from './stop-loss-take-profit.controller';
import { StopLossTakeProfitService } from './stop-loss-take-profit.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [StopLossTakeProfitController],
  providers: [StopLossTakeProfitService],
  exports: [StopLossTakeProfitService],
})
export class StopLossTakeProfitModule {}
