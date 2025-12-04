/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// jwt-ws.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedSocket } from 'src/chat/dtos/chat.dto';
import { ValidateUser } from 'src/globals/validateUser.dto';

@Injectable()
export class JwtWsGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client = context.switchToWs().getClient<AuthenticatedSocket>();

      const token =
        this.extractTokenFromCookie(client) ||
        this.extractTokenFromAuth(client);

      if (!token) {
        throw new WsException('Unauthorized');
      }

      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET as string,
      ) as ValidateUser;

      client.data.user = payload;
      console.log(' User authenticated:', payload.email);
      return true;
    } catch (err) {
      console.log(' Auth failed:', (err as Error).message);
      throw new WsException('Unauthorized');
    }
  }

  private extractTokenFromAuth(client: AuthenticatedSocket): string | null {
    return client.handshake.auth.token || null;
  }

  private extractTokenFromCookie(client: AuthenticatedSocket): string | null {
    const cookieHeader = client.handshake.headers.cookie;

    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader
      .split('; ')
      .reduce<Record<string, string>>((acc, cookie) => {
        const [key, value] = cookie.split('=');
        acc[key] = value;
        return acc;
      }, {});

    return cookies['jwt'] || null;
  }
}
