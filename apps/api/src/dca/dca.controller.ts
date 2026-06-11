import { Controller, Get, Param, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DcaService } from './dca.service';
import { DcaCalculation, DcaSnapshot } from '@g-fund/types';

@ApiTags('定投计算')
@Controller('dca')
export class DcaController {
  constructor(private readonly service: DcaService) {}

  @Get()
  @ApiOperation({ summary: '计算所有基金的定投金额' })
  async calculate(): Promise<DcaCalculation[]> {
    return this.service.calculate();
  }

  @Get('next-date')
  @ApiOperation({ summary: '获取下次定投日期' })
  async getNextDate(): Promise<{ nextDate: string; isToday: boolean }> {
    return this.service.getNextDcaDate();
  }

  @Get(':fundCode')
  @ApiOperation({ summary: '计算指定基金的定投金额' })
  async calculateByFund(@Param('fundCode') fundCode: string): Promise<DcaCalculation | null> {
    return this.service.calculateByFund(fundCode);
  }

  @Get('snapshots/:planDate')
  @ApiOperation({ summary: '获取指定日期的定投快照' })
  async getSnapshots(@Param('planDate') planDate: string): Promise<DcaSnapshot[]> {
    return this.service.getSnapshots(planDate);
  }

  @Patch('snapshots/:id/execute')
  @ApiOperation({ summary: '标记快照为已执行' })
  async markExecuted(@Param('id') id: string): Promise<DcaSnapshot> {
    return this.service.markSnapshotExecuted(parseInt(id, 10));
  }
}
