import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import type { SyncStreamEvent } from '@g-fund/types';
import { PositionsService } from './positions.service';
import { PositionsSyncService } from './positions-sync.service';
import { UpsertPositionDto } from './dto/upsert-position.dto';

@ApiTags('positions')
@Controller('positions')
export class PositionsController {
  constructor(
    private readonly positionsService: PositionsService,
    private readonly positionsSyncService: PositionsSyncService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取所有持仓' })
  findAll() {
    return this.positionsService.findAll();
  }

  @Post('sync')
  @HttpCode(200)
  @ApiOperation({ summary: '一键同步：从 MCP 拉取最新净值并更新各基金市值（一次性返回）' })
  sync() {
    return this.positionsSyncService.syncAll();
  }

  @Sse('sync/stream')
  @ApiOperation({ summary: '一键同步：SSE 流式推送 per-fund 进度' })
  syncStream(): Observable<{ data: string }> {
    return this.positionsSyncService
      .syncStream()
      .pipe(map((event: SyncStreamEvent) => ({ data: JSON.stringify(event) })));
  }

  @Put()
  @ApiOperation({ summary: '建仓 / 修正快照（仅在该基金无交易流水时可用）' })
  upsert(@Body() dto: UpsertPositionDto) {
    return this.positionsService.upsertSnapshot(dto);
  }

  @Delete(':fundCode')
  @ApiOperation({ summary: '清空快照持仓（仅在该基金无交易流水时可用）' })
  @HttpCode(204)
  async remove(@Param('fundCode') fundCode: string) {
    await this.positionsService.remove(fundCode);
  }

  @Get(':fundCode/nav')
  @ApiOperation({ summary: '从 MCP 实时获取单支基金净值' })
  fetchNav(@Param('fundCode') fundCode: string) {
    return this.positionsSyncService.fetchNav(fundCode);
  }

  @Get(':fundCode')
  @ApiOperation({ summary: '获取单个持仓' })
  findOne(@Param('fundCode') fundCode: string) {
    return this.positionsService.findOne(fundCode);
  }
}
