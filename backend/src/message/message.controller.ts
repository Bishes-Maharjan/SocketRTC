import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwtGuard';
import { Irequest } from 'src/globals/Req.dto';
import { MessageService } from './message.service';

@Controller('message')
export class MessageController {
  constructor(private messageService: MessageService) {}
  @Get(':roomId')
  @UseGuards(JwtGuard)
  getAllMessages(
    @Param('roomId') roomId: string,
    @Request() { user: { id: userId } }: Irequest,
    @Query() query: { limit?: number; page?: number },
  ) {
    return this.messageService.getRoomMessagesWithItsUnreadCount(
      userId,
      roomId,
      query,
    );
  }
  @Get('unread/:userId')
  @UseGuards(JwtGuard)
  getTotalUnreadCount(@Param('userId') userId: string) {
    return this.messageService.getTotalUnreadMessages(userId);
  }
}
