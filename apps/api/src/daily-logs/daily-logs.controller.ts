import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DailyLogsService } from './daily-logs.service';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { UpdateDailyLogDto } from './dto/update-daily-log.dto';

@ApiTags('daily-logs')
@Controller('daily-logs')
export class DailyLogsController {
  constructor(private readonly dailyLogsService: DailyLogsService) {}

  @Get()
  @ApiOperation({ summary: '获取每日日志列表' })
  @ApiQuery({ name: 'from', required: false, description: '起始日期 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, description: '结束日期 (YYYY-MM-DD)' })
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.dailyLogsService.findAll(from, to);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单条日志' })
  findOne(@Param('id') id: string) {
    return this.dailyLogsService.findOne(Number(id));
  }

  @Post()
  @ApiOperation({ summary: '新增/更新每日日志（按日期 upsert）' })
  create(@Body() dto: CreateDailyLogDto) {
    return this.dailyLogsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新日志' })
  update(@Param('id') id: string, @Body() dto: UpdateDailyLogDto) {
    return this.dailyLogsService.update(Number(id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除日志' })
  remove(@Param('id') id: string) {
    return this.dailyLogsService.remove(Number(id));
  }
}
