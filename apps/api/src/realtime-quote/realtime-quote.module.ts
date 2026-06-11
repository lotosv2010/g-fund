import { Module } from '@nestjs/common';
import { RealtimeQuoteController } from './realtime-quote.controller';
import { RealtimeQuoteService } from './realtime-quote.service';

@Module({
  controllers: [RealtimeQuoteController],
  providers: [RealtimeQuoteService],
  exports: [RealtimeQuoteService],
})
export class RealtimeQuoteModule {}
