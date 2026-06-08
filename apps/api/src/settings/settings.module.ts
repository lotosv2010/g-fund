import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { FundsModule } from '../funds/funds.module';

@Module({
  imports: [FundsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
