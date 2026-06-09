import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
  AppendMessageDto,
  CreateSessionDto,
  RenameSessionDto,
} from './dto/chat.dto';

@ApiTags('chat')
@Controller('chat/sessions')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: '会话列表' })
  list() {
    return this.chatService.listSessions();
  }

  @Post()
  @ApiOperation({ summary: '新建会话' })
  create(@Body() dto: CreateSessionDto) {
    return this.chatService.createSession(dto.title);
  }

  @Get(':id')
  @ApiOperation({ summary: '会话详情（含全部消息）' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.chatService.getSession(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '重命名会话' })
  rename(@Param('id', ParseIntPipe) id: number, @Body() dto: RenameSessionDto) {
    return this.chatService.renameSession(id, dto.title);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除会话' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.chatService.deleteSession(id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: '追加消息（前端 SSE 完成后调用）' })
  appendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AppendMessageDto,
  ) {
    return this.chatService.appendMessage(id, dto);
  }
}
