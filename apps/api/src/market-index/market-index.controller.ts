import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MarketIndexService } from './market-index.service';

@ApiTags('market-index')
@Controller('market-index')
export class MarketIndexController {
  constructor(private readonly service: MarketIndexService) {}

  @Get('realtime')
  @ApiOperation({ summary: '获取实时指数行情' })
  @ApiQuery({ name: 'codes', required: false, description: '逗号分隔的指数代码，为空则使用用户关注列表或默认列表' })
  async fetchRealtime(@Query('codes') codes?: string) {
    const indices = await this.service.resolveIndices(codes);
    return this.service.fetchRealtime(indices);
  }

  @Get(':code/history')
  @ApiOperation({ summary: '获取指数历史数据' })
  fetchHistory(
    @Param('code') code: string,
    @Query('days') days?: string,
  ) {
    const d = days ? parseInt(days, 10) : 30;
    return this.service.fetchHistory(code, d);
  }
}
