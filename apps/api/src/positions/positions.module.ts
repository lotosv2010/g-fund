import { Module } from '@nestjs/common';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';
import { PositionsSyncService } from './positions-sync.service';
import { SettingsModule } from '../settings/settings.module';
import { RealtimeQuoteModule } from '../realtime-quote/realtime-quote.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [SettingsModule, RealtimeQuoteModule, TransactionsModule],
  controllers: [PositionsController],
  providers: [PositionsService, PositionsSyncService],
})
export class PositionsModule {}
