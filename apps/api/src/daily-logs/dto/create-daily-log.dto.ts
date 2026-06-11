import { IsDateString, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class StageChangeDto {
  @ApiProperty()
  @IsString()
  fundCode!: string;

  @ApiProperty()
  @IsString()
  fundName!: string;

  @ApiProperty({ enum: ['dca', 'holding'] })
  @IsString()
  fromStage!: 'dca' | 'holding';

  @ApiProperty({ enum: ['dca', 'holding'] })
  @IsString()
  toStage!: 'dca' | 'holding';

  @ApiProperty()
  progress!: number;

  @ApiProperty({ enum: ['buy', 'sell', 'rollback_buy', 'rollback_sell', 'target_change'] })
  @IsString()
  trigger!: 'buy' | 'sell' | 'rollback_buy' | 'rollback_sell' | 'target_change';

  @ApiProperty()
  @IsString()
  timestamp!: string;
}

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

  @ApiPropertyOptional({ type: [StageChangeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageChangeDto)
  stageChanges?: StageChangeDto[];
}
