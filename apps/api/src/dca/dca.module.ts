import { Module } from '@nestjs/common';
import { DcaController } from './dca.controller';
import { DcaService } from './dca.service';
import { DbModule } from '../db/db.module';
import { RulesModule } from '../rules/rules.module';
import { MarketIndexModule } from '../market-index/market-index.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [DbModule, RulesModule, MarketIndexModule, SettingsModule],
  controllers: [DcaController],
  providers: [DcaService],
  exports: [DcaService],
})
export class DcaModule {}
