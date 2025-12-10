import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Req,
    Request,
    UseGuards,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwtGuard';
import { Irequest, paginationQuery } from 'src/globals/Req.dto';
import { TranslateDto } from './dto/translate.dto';
import { MessageService } from './message.service';
import { TranslateService } from './translate.service';

@UseGuards(JwtGuard)
@Controller('message')
export class MessageController {
  constructor(
    private messageService: MessageService,
    private translateService: TranslateService,
  ) {}

  // Get supported languages for translation
  @Get('languages')
  getSupportedLanguages() {
    return this.translateService.getSupportedLanguages();
  }

  // Translate message text
  @Post('translate')
  async translateMessage(@Body() { text, targetLanguage }: TranslateDto) {
    return this.translateService.translateText(text, targetLanguage);
  }

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
