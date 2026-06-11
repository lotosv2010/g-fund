import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MarketIndexService } from './market-index.service';
import { SettingsService } from '../settings/settings.service';
import type { IndexConfig } from '@g-fund/types';
import { DEFAULT_INDICES } from '@g-fund/types';

@ApiTags('market-index')
@Controller('market-index')
export class MarketIndexController {
  constructor(
    private readonly service: MarketIndexService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get('realtime')
  @ApiOperation({ summary: '获取实时指数行情' })
  @ApiQuery({ name: 'codes', required: false, description: '逗号分隔的指数代码，为空则使用用户关注列表或默认列表' })
  async fetchRealtime(@Query('codes') codes?: string) {
    const indices = await this.resolveIndices(codes);
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

  private async resolveIndices(codesParam?: string): Promise<IndexConfig[]> {
    if (codesParam) {
      return codesParam.split(',').map((c) => {
        const found = DEFAULT_INDICES.find((d) => d.code === c.trim());
        return found ?? { code: c.trim(), name: c.trim() };
      });
    }

    try {
      const setting = await this.settingsService.get('watchlist_indices');
      const watchlist: string[] = JSON.parse(setting.value);
      if (Array.isArray(watchlist) && watchlist.length > 0) {
        return watchlist.map((c) => {
          const found = DEFAULT_INDICES.find((d) => d.code === c);
          return found ?? { code: c, name: c };
        });
      }
    } catch {
      // no watchlist configured, use defaults
    }

    return DEFAULT_INDICES;
  }
}
