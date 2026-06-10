import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { McpService } from '../mcp/mcp.service';
import type { AiConfig, McpConfig } from '@g-fund/types';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly mcp: McpService,
  ) {}

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

  @Get('ai/config')
  @ApiOperation({ summary: '获取 AI 配置' })
  getAiConfig() {
    return this.settingsService.getAiConfig();
  }

  @Put('ai/config')
  @ApiOperation({ summary: '更新 AI 配置' })
  setAiConfig(@Body() config: AiConfig) {
    return this.settingsService.setAiConfig(config);
  }

  @Get('mcp/config')
  @ApiOperation({ summary: '获取 MCP 配置' })
  getMcpConfig() {
    return this.settingsService.getMcpConfig();
  }

  @Put('mcp/config')
  @ApiOperation({ summary: '更新 MCP 配置' })
  setMcpConfig(@Body() config: McpConfig) {
    return this.settingsService.setMcpConfig(config);
  }

  @Get('mcp/tools')
  @ApiOperation({ summary: '列出 MCP 可用工具' })
  getMcpTools() {
    return this.mcp.getTools().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }
}
