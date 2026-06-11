import { Module } from '@nestjs/common';
import { MarketIndexController } from './market-index.controller';
import { MarketIndexService } from './market-index.service';

@Module({
  controllers: [MarketIndexController],
  providers: [MarketIndexService],
  exports: [MarketIndexService],
})
export class MarketIndexModule {}
