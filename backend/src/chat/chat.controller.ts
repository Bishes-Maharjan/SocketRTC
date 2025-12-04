import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/auth/guard/jwtGuard';
import { Irequest, paginationQuery } from 'src/globals/Req.dto';
import { ChatService } from './chat.service';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}
  @UseGuards(JwtGuard)
  @Get()
  async getRoomId(
    @Query() query: paginationQuery,
    @Req() { user: { id } }: Irequest,
  ) {
    return await this.chatService.getAllChatRooms(id, query);
  }

  @UseGuards(JwtGuard)
  @Get('check-room/:roomId')
  async checkRoomId(
    @Param('roomId') roomId: string,
    @Req() { user: { id: userId } }: Irequest,
  ) {
    const room = await this.chatService.checkRoomId(roomId);
    if (!room.members.find((id) => id == userId))
      throw new ForbiddenException('User not a part of the conversation');
    return room;
  }
}
