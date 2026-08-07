import { Injectable, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminGuard extends AuthGuard('jwt') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest(err: any, user: any, _info: any): any {
    if (err || !user) {
      throw new ForbiddenException('需要登录');
    }
    if (user.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return user;
  }
}
