import { IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { StageChangeDto } from './create-daily-log.dto';

export class UpdateDailyLogDto {
  @ApiPropertyOptional({ example: '今日加仓消费基金 1000 元' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ example: '大盘缩量震荡，消费板块相对抗跌' })
  @IsOptional()
  @IsString()
  marketNote?: string;

  @ApiPropertyOptional({ type: [StageChangeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageChangeDto)
  stageChanges?: StageChangeDto[];
}
