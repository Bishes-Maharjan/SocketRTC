import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwtGuard';
import { Irequest, paginationQuery } from 'src/globals/Req.dto';
import { MessageService } from './message.service';

@UseGuards(JwtGuard)
@Controller('message')
export class MessageController {
  constructor(private messageService: MessageService) {}

  // get total notification for unread messages
  @Get('unread')
  getTotalUnreadCount(@Req() { user }: Irequest) {
    return this.messageService.getTotalUnreadMessages(user.id);
  }

  //Read messages after joining in the room
  @Get('read/:roomId')
  getUnreadMessageForARoom(
    @Param('roomId') roomId: string,
    @Req() { user: { id: userId } }: Irequest,
  ) {
    return this.messageService.readMessage(roomId, userId);
  }

  //Get Messages for infinite query
  @Get(':roomId')
  getAllMessages(
    @Param('roomId') roomId: string,
    @Request() { user: { id: userId } }: Irequest,
    @Query() query: paginationQuery,
  ) {
    return this.messageService.getRoomMessagesWithItsUnreadCount(
      userId,
      roomId,
      query,
    );
  }
}
