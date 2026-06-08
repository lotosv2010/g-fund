import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: '获取交易流水' })
  @ApiQuery({ name: 'fundCode', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['buy', 'sell'] })
  findAll(
    @Query('fundCode') fundCode?: string,
    @Query('type') type?: string,
  ) {
    return this.transactionsService.findAll(fundCode, type);
  }

  @Post()
  @ApiOperation({ summary: '创建交易（买入/卖出）' })
  create(@Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除交易（回滚持仓）' })
  remove(@Param('id') id: string) {
    return this.transactionsService.remove(parseInt(id, 10));
  }
}
