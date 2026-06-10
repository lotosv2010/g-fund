import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StopLossTakeProfitService } from './stop-loss-take-profit.service';
import { StopLossTakeProfitSignal } from '@g-fund/types';

@ApiTags('止盈止损')
@Controller('stop-loss-take-profit')
export class StopLossTakeProfitController {
  constructor(private readonly service: StopLossTakeProfitService) {}

  @Get()
  @ApiOperation({ summary: '获取所有止盈止损信号' })
  async getSignals(): Promise<StopLossTakeProfitSignal[]> {
    return this.service.getSignals();
  }

  @Get(':fundCode')
  @ApiOperation({ summary: '获取指定基金的止盈止损信号' })
  async getSignalsByFund(@Param('fundCode') fundCode: string): Promise<StopLossTakeProfitSignal[]> {
    return this.service.getSignalsByFund(fundCode);
  }
}
