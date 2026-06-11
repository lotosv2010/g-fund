import { Controller, Get, Param, Query, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StopLossTakeProfitService } from './stop-loss-take-profit.service';
import { StopLossTakeProfitSignal } from '@g-fund/types';

@ApiTags('止盈止损')
@Controller('stop-loss-take-profit')
export class StopLossTakeProfitController {
  constructor(private readonly service: StopLossTakeProfitService) {}

  @Get()
  @ApiOperation({ summary: '获取所有止盈止损信号（含四态预警）' })
  async getSignals(): Promise<StopLossTakeProfitSignal[]> {
    return this.service.getSignals();
  }

  @Get(':fundCode')
  @ApiOperation({ summary: '获取指定基金的止盈止损信号' })
  async getSignalsByFund(@Param('fundCode') fundCode: string): Promise<StopLossTakeProfitSignal[]> {
    return this.service.getSignalsByFund(fundCode);
  }

  @Get('history')
  @ApiOperation({ summary: '获取信号历史记录' })
  @ApiQuery({ name: 'fundCode', required: false })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getSignalHistory(
    @Query('fundCode') fundCode?: string,
    @Query('days') days?: number,
  ) {
    return this.service.getSignalHistory(fundCode, days ? Number(days) : undefined);
  }

  @Patch('history/:id/resolve')
  @ApiOperation({ summary: '标记信号已解决' })
  async resolveSignal(@Param('id') id: string) {
    await this.service.resolveSignal(Number(id));
    return { success: true };
  }
}
