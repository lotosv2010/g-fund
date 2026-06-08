import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(':key')
  @ApiOperation({ summary: '获取配置' })
  get(@Param('key') key: string) {
    return this.settingsService.get(key);
  }

  @Put(':key')
  @ApiOperation({ summary: '更新配置' })
  set(@Param('key') key: string, @Body() body: { value: string }) {
    return this.settingsService.set(key, body.value);
  }
}
