import { IsString, IsOptional, IsNumberString, IsInt, Min, Max, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ example: '10000.00' })
  @IsOptional()
  @IsNumberString()
  costAmount?: string;

  @ApiPropertyOptional({ example: '10500.00' })
  @IsOptional()
  @IsNumberString()
  currentValue?: string;

  @ApiPropertyOptional({ example: '20000.00' })
  @IsOptional()
  @IsNumberString()
  targetAmount?: string;

  @ApiPropertyOptional({ example: '20.00' })
  @IsOptional()
  @IsNumberString()
  targetRatio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
