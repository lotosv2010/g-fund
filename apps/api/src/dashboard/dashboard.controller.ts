import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import type { AssetAllocationResponse, RebalanceResponse } from '@g-fund/types';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('asset-allocation')
  @ApiOperation({ summary: '获取持仓资产配置分类' })
  async getAssetAllocation(): Promise<AssetAllocationResponse> {
    return this.service.getAssetAllocation();
  }

  @Get('rebalance')
  @ApiOperation({ summary: '获取再平衡建议' })
  async getRebalance(): Promise<RebalanceResponse> {
    return this.service.getRebalanceSuggestion();
  }
}
