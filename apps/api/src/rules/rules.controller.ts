import { Controller, Get, Put, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RulesService } from './rules.service';
import type { DcaRules, SlpRules, FundRuleOverride, FundRuleOverrideType } from '@g-fund/types';

@ApiTags('规则配置')
@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get('dca')
  @ApiOperation({ summary: '获取定投规则' })
  getDcaRules(): Promise<DcaRules> {
    return this.rulesService.getDcaRules();
  }

  @Put('dca')
  @ApiOperation({ summary: '更新定投规则' })
  setDcaRules(@Body() rules: DcaRules): Promise<void> {
    return this.rulesService.setDcaRules(rules);
  }

  @Post('dca/reset')
  @ApiOperation({ summary: '恢复定投规则默认值' })
  resetDcaRules(): Promise<DcaRules> {
    return this.rulesService.resetDcaRules();
  }

  @Get('slp')
  @ApiOperation({ summary: '获取止盈止损规则' })
  getSlpRules(): Promise<SlpRules> {
    return this.rulesService.getSlpRules();
  }

  @Put('slp')
  @ApiOperation({ summary: '更新止盈止损规则' })
  setSlpRules(@Body() rules: SlpRules): Promise<void> {
    return this.rulesService.setSlpRules(rules);
  }

  @Post('slp/reset')
  @ApiOperation({ summary: '恢复止盈止损规则默认值' })
  resetSlpRules(): Promise<SlpRules> {
    return this.rulesService.resetSlpRules();
  }

  @Get('funds/:code/overrides')
  @ApiOperation({ summary: '获取基金例外规则' })
  getFundOverrides(@Param('code') code: string): Promise<FundRuleOverride[]> {
    return this.rulesService.getFundOverrides(code);
  }

  @Put('funds/:code/overrides/:type')
  @ApiOperation({ summary: '设置基金例外规则' })
  setFundOverride(
    @Param('code') code: string,
    @Param('type') type: FundRuleOverrideType,
    @Body() body: { enabled: boolean; value?: number | null },
  ): Promise<FundRuleOverride> {
    return this.rulesService.setFundOverride(code, type, body.enabled, body.value);
  }
}
