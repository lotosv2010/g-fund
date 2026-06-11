import { Module } from '@nestjs/common';
import { AgentToolsService } from './agent-tools.service';
import { DcaModule } from '../dca/dca.module';
import { StopLossTakeProfitModule } from '../stop-loss-take-profit/stop-loss-take-profit.module';
import { RealtimeQuoteModule } from '../realtime-quote/realtime-quote.module';
import { RulesModule } from '../rules/rules.module';
import { FundsModule } from '../funds/funds.module';

@Module({
  imports: [DcaModule, StopLossTakeProfitModule, RealtimeQuoteModule, RulesModule, FundsModule],
  providers: [AgentToolsService],
  exports: [AgentToolsService],
})
export class AgentModule {}
