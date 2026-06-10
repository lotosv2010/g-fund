import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DcaService } from './dca.service';
import { DcaCalculation } from '@g-fund/types';

@ApiTags('定投计算')
@Controller('dca')
export class DcaController {
  constructor(private readonly service: DcaService) {}

  @Get()
  @ApiOperation({ summary: '计算所有基金的定投金额' })
  async calculate(): Promise<DcaCalculation[]> {
    return this.service.calculate();
  }

  @Get(':fundCode')
  @ApiOperation({ summary: '计算指定基金的定投金额' })
  async calculateByFund(@Param('fundCode') fundCode: string): Promise<DcaCalculation | null> {
    return this.service.calculateByFund(fundCode);
  }
}
