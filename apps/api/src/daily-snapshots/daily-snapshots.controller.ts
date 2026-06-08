import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DailySnapshotsService } from './daily-snapshots.service';

@ApiTags('daily-snapshots')
@Controller('daily-snapshots')
export class DailySnapshotsController {
  constructor(private readonly snapshotsService: DailySnapshotsService) {}

  @Get()
  @ApiOperation({ summary: '获取每日快照列表' })
  @ApiQuery({ name: 'from', required: false, description: '起始日期 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, description: '结束日期 (YYYY-MM-DD)' })
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.snapshotsService.findAll(from, to);
  }

  @Get(':date')
  @ApiOperation({ summary: '获取指定日期的快照' })
  findOne(@Param('date') date: string) {
    return this.snapshotsService.findOne(date);
  }

  @Post('generate')
  @ApiOperation({ summary: '生成今日资产快照' })
  generate() {
    return this.snapshotsService.generate();
  }
}
