import { IsIn, IsOptional, IsString, MaxLength, MinLength, IsBoolean } from 'class-validator';

const ROLES = ['user', 'assistant', 'tool', 'system'] as const;
const KINDS = ['user', 'assistant', 'thinking', 'tool_call', 'tool_result', 'error'] as const;

export class CreateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

export class RenameSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;
}

export class AppendMessageDto {
  @IsIn(ROLES as unknown as string[])
  role!: (typeof ROLES)[number];

  @IsIn(KINDS as unknown as string[])
  kind!: (typeof KINDS)[number];

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tool?: string;

  @IsOptional()
  @IsBoolean()
  truncated?: boolean;
}
