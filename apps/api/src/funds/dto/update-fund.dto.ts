import { IsString, IsOptional, IsNumberString, IsInt, Min, Max, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  costAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  currentValue?: string;

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
  @IsString()
  note?: string;
}
