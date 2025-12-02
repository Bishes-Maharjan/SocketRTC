import {
  Controller,
  Get,
  HttpCode,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/auth/guard/jwtGuard';
import { Irequest } from 'src/globals/Req.dto';
import { ChatService } from './chat.service';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}
  @ApiOperation({ summary: 'Get Stream Token' })
  @HttpCode(200)
  @UseGuards(JwtGuard)
  @Get('token')
  getStreamToken(@Req() { user: { id } }: Irequest) {
    return this.chatService.getStreamToken(id);
  }

  @Get(':userId')
  @UseGuards(JwtGuard)
  async getRoomId(
    @Req() { user: { id } }: Irequest,
    @Param('userId') receptientId: string,
  ) {
    return await this.chatService.createChatRoomId(id, receptientId);
  }
}
