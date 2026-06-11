import { Module } from '@nestjs/common';
import { FundsController } from './funds.controller';
import { FundsService } from './funds.service';
import { FundEnrichmentService } from './fund-enrichment.service';

@Module({
  controllers: [FundsController],
  providers: [FundsService, FundEnrichmentService],
  exports: [FundsService, FundEnrichmentService],
})
export class FundsModule {}
