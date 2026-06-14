import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DbModule } from '../db/db.module';
import { MarketIndexModule } from '../market-index/market-index.module';

@Module({
  imports: [DbModule, MarketIndexModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
