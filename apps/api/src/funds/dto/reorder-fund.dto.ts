import { IsString, IsInt, IsArray, ValidateNested, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ReorderItem {
  @ApiProperty({ example: '013316' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderFundDto {
  @ApiProperty({ type: [ReorderItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items!: ReorderItem[];
}
