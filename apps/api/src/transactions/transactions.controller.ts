import { Controller, Get, Post, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger';
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
  @ApiQuery({ name: 'startDate', required: false, description: '交易日期起始（YYYY-MM-DD）' })
  @ApiQuery({ name: 'endDate', required: false, description: '交易日期截止（YYYY-MM-DD）' })
  findAll(
    @Query('fundCode') fundCode?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.transactionsService.findAll(fundCode, type, startDate, endDate);
  }

  @Post()
  @ApiOperation({ summary: '创建交易（买入/卖出）' })
  create(@Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(dto);
  }

  @Post('import')
  @ApiOperation({ summary: '批量导入交易（CSV）' })
  @ApiConsumes('multipart/form-data')
  async import(@Req() req: { file: () => Promise<{ toBuffer: () => Promise<Buffer>; fields: Record<string, unknown> }> }) {
    const data = await req.file();
    if (!data) {
      throw new Error('请上传 CSV 文件');
    }

    const buffer = await data.toBuffer();
    const content = buffer.toString('utf-8');
    const format = data.fields?.format as string | undefined;

    return this.transactionsService.importFromCsv(content, format);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除交易（回滚持仓）' })
  remove(@Param('id') id: string) {
    return this.transactionsService.remove(parseInt(id, 10));
  }
}
