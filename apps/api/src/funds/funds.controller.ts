import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FundsService } from './funds.service';
import { CreateFundDto } from './dto/create-fund.dto';
import { UpdateFundDto } from './dto/update-fund.dto';

@ApiTags('funds')
@Controller('funds')
export class FundsController {
  constructor(private readonly fundsService: FundsService) {}

  @Get()
  @ApiOperation({ summary: '获取基金列表' })
  findAll() {
    return this.fundsService.findAll();
  }

  @Get(':code')
  @ApiOperation({ summary: '获取单支基金' })
  findOne(@Param('code') code: string) {
    return this.fundsService.findOne(code);
  }

  @Post()
  @ApiOperation({ summary: '新增基金' })
  create(@Body() dto: CreateFundDto) {
    return this.fundsService.create(dto);
  }

  @Patch(':code')
  @ApiOperation({ summary: '更新基金信息' })
  update(@Param('code') code: string, @Body() dto: UpdateFundDto) {
    return this.fundsService.update(code, dto);
  }

  @Delete(':code')
  @ApiOperation({ summary: '删除基金' })
  remove(@Param('code') code: string) {
    return this.fundsService.remove(code);
  }
}
