import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { MessageModule } from './message/message.module';
import { UserModule } from './user/user.module';
import { ExceptionHandler } from './utils/exception/exception.handler';
import { WinstonLoggerModule } from './utils/winston/winston.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 10,
      },
    ]),
    MongooseModule.forRoot(process.env.MONGO_URI ?? '123', {}),
    AuthModule,
    UserModule,
    WinstonLoggerModule,
    ChatModule,
    MessageModule,
    UploadModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: ExceptionHandler,
    },
  ],
})
export class AppModule {}
