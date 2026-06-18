import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import type { AssetAllocationResponse, RebalanceResponse, RiskSummaryResponse, BenchmarkComparisonResponse, AnomalyResponse, IndustryExposureResponse } from '@g-fund/types';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('asset-allocation')
  @ApiOperation({ summary: '获取持仓资产配置分类' })
  async getAssetAllocation(@Query('refresh') refresh?: string): Promise<AssetAllocationResponse> {
    if (refresh === 'true') {
      this.service.clearCache();
    }
    return this.service.getAssetAllocation();
  }

  @Get('rebalance')
  @ApiOperation({ summary: '获取再平衡建议' })
  async getRebalance(): Promise<RebalanceResponse> {
    return this.service.getRebalanceSuggestion();
  }

  @Get('risk-summary')
  @ApiOperation({ summary: '获取组合风险简表（最大回撤/年化波动率/当前回撤）' })
  async getRiskSummary(): Promise<RiskSummaryResponse> {
    return this.service.getRiskSummary();
  }

  @Get('benchmark')
  @ApiOperation({ summary: '获取组合 vs 沪深300 累计收益率对比' })
  async getBenchmark(): Promise<BenchmarkComparisonResponse> {
    return this.service.getBenchmarkComparison();
  }

  @Get('anomalies')
  @ApiOperation({ summary: '获取持仓异动提示（涨跌>3%/估值越线/止损触发）' })
  async getAnomalies(): Promise<AnomalyResponse> {
    return this.service.getAnomalies();
  }

  @Get('industry-exposure')
  @ApiOperation({ summary: '获取持仓行业暴露分布（level2 行业聚合）' })
  async getIndustryExposure(): Promise<IndustryExposureResponse> {
    return this.service.getIndustryExposure();
  }
}
