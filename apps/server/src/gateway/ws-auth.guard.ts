import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { JwtPayload } from '../modules/auth/auth.types';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const token = this.extractToken(client);

    if (!token) {
      // 允许未认证连接（游客模式），但不设置 userId
      this.logger.debug(`WS connection without token: ${client.id}`);
      return true;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).userId = payload.sub;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).username = payload.username;
      this.logger.debug(`WS authenticated: ${payload.username} (${client.id})`);
      return true;
    } catch {
      this.logger.warn(`WS invalid token from client: ${client.id}`);
      // 允许连接但标记为未认证
      return true;
    }
  }

  private extractToken(client: Socket): string | undefined {
    // 从 handshake auth 中提取
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const auth = (client.handshake as any).auth;
    if (auth?.token) {
      return auth.token;
    }

    // 从 query 参数中提取
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return undefined;
  }
}
