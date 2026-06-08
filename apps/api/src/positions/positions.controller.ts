import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PositionsService } from './positions.service';

@ApiTags('positions')
@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @ApiOperation({ summary: '获取所有持仓' })
  findAll() {
    return this.positionsService.findAll();
  }

  @Get(':fundCode')
  @ApiOperation({ summary: '获取单个持仓' })
  findOne(@Param('fundCode') fundCode: string) {
    return this.positionsService.findOne(fundCode);
  }
}
