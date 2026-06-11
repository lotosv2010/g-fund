import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MarketIndexService } from './market-index.service';

@Injectable()
export class MarketIndexScheduler {
  private readonly logger = new Logger(MarketIndexScheduler.name);

  constructor(private readonly marketIndexService: MarketIndexService) {}

  // 交易日 9:30~15:00 每 30s 刷新缓存（周一~周五）
  @Cron('*/30 * 9-14 * * 1-5')
  async refreshDuringTrading() {
    if (!this.isTradingHours()) return;
    try {
      await this.marketIndexService.fetchRealtime();
    } catch (err) {
      this.logger.warn(`Trading refresh failed: ${(err as Error).message}`);
    }
  }

  // 14:30~15:00 每 30s 也刷新（覆盖收盘前半小时）
  @Cron('*/30 30-59 14 * * 1-5')
  async refreshBeforeClose() {
    try {
      await this.marketIndexService.fetchRealtime();
    } catch (err) {
      this.logger.warn(`Pre-close refresh failed: ${(err as Error).message}`);
    }
  }

  // 盘后归档：15:05 执行一次，将当日收盘数据写入 DB
  @Cron('5 15 * * 1-5')
  async archiveAfterClose() {
    try {
      const count = await this.marketIndexService.archiveToday();
      this.logger.log(`After-close archive completed: ${count} records`);
    } catch (err) {
      this.logger.error(`After-close archive failed: ${(err as Error).message}`);
    }
  }

  private isTradingHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const time = hour * 100 + minute;

    // 9:30 ~ 11:30 或 13:00 ~ 15:00
    return (time >= 930 && time <= 1130) || (time >= 1300 && time <= 1500);
  }
}
