import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageModule } from 'src/message/message.module';

import { ChatController } from './chat.controller';
// import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatGateway } from './gateways/chat.gateway';
import { WebRtcGateway } from './gateways/video.gateway';
import { Chat, ChatSchema } from './model/chat.model';
import { Message, MessageSchema } from 'src/message/models/message.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Chat.name,
        schema: ChatSchema,
      },
      {
        name: Message.name,
        schema: MessageSchema,
      },
    ]),
    MessageModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, WebRtcGateway, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
