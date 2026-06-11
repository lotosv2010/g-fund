import { IsString, IsOptional, IsNumberString, IsInt, IsIn, Min, Max, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  FUND_CATEGORIES,
  FUND_PHASES,
  VALUATION_LEVELS,
  LIFECYCLE_STAGES,
  ASSET_TYPES,
} from '@g-fund/types';

export class UpdateFundDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  riskLevel?: number;

  @ApiPropertyOptional({ enum: FUND_CATEGORIES })
  @IsOptional()
  @IsString()
  @IsIn(FUND_CATEGORIES)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  targetAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  targetRatio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  valuationPercentile?: string;

  @ApiPropertyOptional({ enum: FUND_PHASES })
  @IsOptional()
  @IsString()
  @IsIn(FUND_PHASES)
  phase?: string;

  @ApiPropertyOptional({ enum: VALUATION_LEVELS })
  @IsOptional()
  @IsString()
  @IsIn(VALUATION_LEVELS)
  valuationLevel?: string;

  @ApiPropertyOptional({ enum: LIFECYCLE_STAGES })
  @IsOptional()
  @IsString()
  @IsIn(LIFECYCLE_STAGES)
  lifecycleStage?: string;

  @ApiPropertyOptional({ enum: ASSET_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(ASSET_TYPES)
  assetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  baseAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
