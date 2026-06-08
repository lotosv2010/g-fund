import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDailyLogDto {
  @ApiPropertyOptional({ example: '今日加仓消费基金 1000 元' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ example: '大盘缩量震荡，消费板块相对抗跌' })
  @IsOptional()
  @IsString()
  marketNote?: string;
}
