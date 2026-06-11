import { Module } from '@nestjs/common';
import { StopLossTakeProfitController } from './stop-loss-take-profit.controller';
import { StopLossTakeProfitService } from './stop-loss-take-profit.service';
import { DbModule } from '../db/db.module';
import { RulesModule } from '../rules/rules.module';
import { RealtimeQuoteModule } from '../realtime-quote/realtime-quote.module';

@Module({
  imports: [DbModule, RulesModule, RealtimeQuoteModule],
  controllers: [StopLossTakeProfitController],
  providers: [StopLossTakeProfitService],
  exports: [StopLossTakeProfitService],
})
export class StopLossTakeProfitModule {}
