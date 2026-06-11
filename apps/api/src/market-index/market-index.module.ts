import { Module } from '@nestjs/common';
import { MarketIndexController } from './market-index.controller';
import { MarketIndexService } from './market-index.service';
import { MarketIndexScheduler } from './market-index.scheduler';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [MarketIndexController],
  providers: [MarketIndexService, MarketIndexScheduler],
  exports: [MarketIndexService],
})
export class MarketIndexModule {}
