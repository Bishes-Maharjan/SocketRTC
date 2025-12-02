import { Controller, Get, Param } from '@nestjs/common';
import { MessageService } from './message.service';

@Controller('message')
export class MessageController {
  constructor(private messageService: MessageService) {}
  @Get('messages/:roomId')
  getAllMessages(@Param('roomId') roomId: string) {
    return this.messageService.getMessage(roomId);
  }
}
