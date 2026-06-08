import { IsString, IsOptional, IsNumberString, IsIn, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty({ example: '110022' })
  @IsString()
  @Length(1, 20)
  fundCode!: string;

  @ApiProperty({ enum: ['buy', 'sell'] })
  @IsString()
  @IsIn(['buy', 'sell'])
  type!: 'buy' | 'sell';

  @ApiProperty({ example: '10000.00' })
  @IsNumberString()
  amount!: string;

  @ApiPropertyOptional({ example: '5000.0000' })
  @IsOptional()
  @IsNumberString()
  shares?: string;

  @ApiPropertyOptional({ example: '1.2345' })
  @IsOptional()
  @IsNumberString()
  price?: string;

  @ApiProperty({ example: '2026-06-08' })
  @IsString()
  tradeDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
