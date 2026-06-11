import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RealtimeQuoteService } from './realtime-quote.service';
import type { BatchQuoteRequest } from './realtime-quote.types';

@ApiTags('realtime-quote')
@Controller('realtime-quote')
export class RealtimeQuoteController {
  constructor(private readonly service: RealtimeQuoteService) {}

  @Get(':code')
  @ApiOperation({ summary: '获取单基金盘中估值（天天基金 API）' })
  fetchQuote(@Param('code') code: string) {
    return this.service.fetchQuote(code);
  }

  @Post('batch')
  @HttpCode(200)
  @ApiOperation({ summary: '批量获取基金盘中估值' })
  fetchQuotes(@Body() body: BatchQuoteRequest) {
    return this.service.fetchQuotes(body.codes);
  }
}
