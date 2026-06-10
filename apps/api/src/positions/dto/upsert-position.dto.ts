import { IsNumberString, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertPositionDto {
  @ApiProperty({ example: '110022' })
  @IsString()
  @Length(1, 20)
  fundCode!: string;

  @ApiProperty({ example: '10000.00', description: '持有金额（元）' })
  @IsNumberString()
  costAmount!: string;

  @ApiProperty({ example: '1.2994', description: '成本净值（系统计算）' })
  @IsNumberString()
  costPrice!: string;

  @ApiProperty({ example: '9500.00', description: '当前市值（元）' })
  @IsNumberString()
  currentValue!: string;

  @ApiProperty({ example: '7695.4700', description: '持有份额（系统计算）' })
  @IsNumberString()
  shares!: string;
}
