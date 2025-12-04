import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/user/model/user.model';
import { UserModule } from 'src/user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
// import { JwtWsGuard } from './guard/jwtWsStrategy';
import { GoogleStrategy } from './strategy/googleStrategy';
import { JwtStrategy } from './strategy/jwtStrategy';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    UserModule,
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
  ],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy, GoogleStrategy],
})
export class AuthModule {}
