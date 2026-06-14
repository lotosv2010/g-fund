import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ImportTransactionsDto {
  @ApiPropertyOptional({ enum: ['auto', 'alipay', 'tiantian', 'danjuan', 'generic'], default: 'auto' })
  @IsOptional()
  @IsString()
  @IsIn(['auto', 'alipay', 'tiantian', 'danjuan', 'generic'])
  format?: 'auto' | 'alipay' | 'tiantian' | 'danjuan' | 'generic';
}
