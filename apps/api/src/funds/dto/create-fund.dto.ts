import { IsString, IsOptional, IsNumberString, IsInt, IsIn, Min, Max, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FUND_CATEGORIES, FUND_PHASES } from '@g-fund/types';

export class CreateFundDto {
  @ApiProperty({ example: '110022' })
  @IsString()
  @Length(1, 20)
  code!: string;

  @ApiProperty({ example: '易方达消费行业' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({ example: '股票型' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  riskLevel?: number;

  @ApiPropertyOptional({ example: 'all', enum: FUND_CATEGORIES })
  @IsOptional()
  @IsString()
  @IsIn(FUND_CATEGORIES)
  category?: string;

  @ApiPropertyOptional({ example: '20000.00' })
  @IsOptional()
  @IsNumberString()
  targetAmount?: string;

  @ApiPropertyOptional({ example: '20.00' })
  @IsOptional()
  @IsNumberString()
  targetRatio?: string;

  @ApiPropertyOptional({ example: '35.50' })
  @IsOptional()
  @IsNumberString()
  valuationPercentile?: string;

  @ApiPropertyOptional({ example: 'low', enum: FUND_PHASES })
  @IsOptional()
  @IsString()
  @IsIn(FUND_PHASES)
  phase?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ example: '1000.00' })
  @IsOptional()
  @IsNumberString()
  baseAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
