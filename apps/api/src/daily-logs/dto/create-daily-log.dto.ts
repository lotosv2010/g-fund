import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDailyLogDto {
  @ApiProperty({ example: '2026-06-08' })
  @IsDateString()
  logDate!: string;

  @ApiPropertyOptional({ example: '今日加仓消费基金 1000 元' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ example: '大盘缩量震荡，消费板块相对抗跌' })
  @IsOptional()
  @IsString()
  marketNote?: string;
}
