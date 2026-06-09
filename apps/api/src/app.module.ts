import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '../../../.env'), '.env'],
    }),
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
  ],
})
export class AppModule {}
