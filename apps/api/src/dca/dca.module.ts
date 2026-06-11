import { Module } from '@nestjs/common';
import { DcaController } from './dca.controller';
import { DcaService } from './dca.service';
import { DbModule } from '../db/db.module';
import { RulesModule } from '../rules/rules.module';

@Module({
  imports: [DbModule, RulesModule],
  controllers: [DcaController],
  providers: [DcaService],
  exports: [DcaService],
})
export class DcaModule {}
