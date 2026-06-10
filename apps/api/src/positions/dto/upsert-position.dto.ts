import { IsNumberString, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertPositionDto {
  @ApiProperty({ example: '110022' })
  @IsString()
  @Length(1, 20)
  fundCode!: string;

  @ApiProperty({ example: '10000.00', description: '持仓金额（元）' })
  @IsNumberString()
  costAmount!: string;

  @ApiProperty({ example: '1.2345', description: '成本净值（每份成本）' })
  @IsNumberString()
  costPrice!: string;
}
