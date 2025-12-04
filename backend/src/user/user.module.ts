import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatModule } from 'src/chat/chat.module';
import {
  FriendRequest,
  FriendRequestSchema,
} from './model/friendRequest.model';
import { User, UserSchema } from './model/user.model';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: FriendRequest.name,
        schema: FriendRequestSchema,
      },
    ]),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    ChatModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
