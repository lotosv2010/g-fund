import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from './db/db.module';
import { McpModule } from './mcp/mcp.module';
import { AgentModule } from './agent/agent.module';
import { AnalysisModule } from './analysis/analysis.module';
import { FundsModule } from './funds/funds.module';
import { PositionsModule } from './positions/positions.module';
import { TransactionsModule } from './transactions/transactions.module';
import { DailyLogsModule } from './daily-logs/daily-logs.module';
import { DailySnapshotsModule } from './daily-snapshots/daily-snapshots.module';
import { SettingsModule } from './settings/settings.module';
import { ChatModule } from './chat/chat.module';
import { StopLossTakeProfitModule } from './stop-loss-take-profit/stop-loss-take-profit.module';
import { DcaModule } from './dca/dca.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RealtimeQuoteModule } from './realtime-quote/realtime-quote.module';
import { MarketIndexModule } from './market-index/market-index.module';
import { RulesModule } from './rules/rules.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '../../../.env'), '.env'],
    }),
    ScheduleModule.forRoot(),
    DbModule,
    McpModule,
    AgentModule,
    AnalysisModule,
    FundsModule,
    PositionsModule,
    TransactionsModule,
    DailyLogsModule,
    DailySnapshotsModule,
    SettingsModule,
    ChatModule,
    StopLossTakeProfitModule,
    DcaModule,
    DashboardModule,
    RealtimeQuoteModule,
    MarketIndexModule,
    RulesModule,
  ],
})
export class AppModule {}
