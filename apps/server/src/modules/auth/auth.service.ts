import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { UserRecord, JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  // 内存用户存储（V1，后续迁移至数据库）
  private users = new Map<string, UserRecord>();
  private usernameIndex = new Map<string, string>(); // username → userId

  constructor(private readonly jwtService: JwtService) {}

  /** 从 UserRecord 中移除 passwordHash，返回安全用户对象 */
  private toSafeUser(user: UserRecord): Omit<UserRecord, 'passwordHash'> {
    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    };
  }

  /**
   * 用户注册
   */
  async register(username: string, password: string): Promise<{ user: Omit<UserRecord, 'passwordHash'>; accessToken: string }> {
    // 验证用户名
    if (!username || username.length < 2 || username.length > 20) {
      throw new ConflictException('用户名需 2-20 个字符');
    }

    if (this.usernameIndex.has(username)) {
      throw new ConflictException('用户名已被使用');
    }

    if (!password || password.length < 6) {
      throw new ConflictException('密码至少 6 位');
    }

    const id = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await bcrypt.hash(password, 10);

    const user: UserRecord = {
      id,
      username,
      passwordHash,
      createdAt: new Date(),
    };

    this.users.set(id, user);
    this.usernameIndex.set(username, id);

    const payload: JwtPayload = { sub: id, username };
    const accessToken = this.jwtService.sign(payload);

    return { user: this.toSafeUser(user), accessToken };
  }

  /**
   * 用户登录
   */
  async login(username: string, password: string): Promise<{ user: Omit<UserRecord, 'passwordHash'>; accessToken: string }> {
    const userId = this.usernameIndex.get(username);
    if (!userId) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const user = this.users.get(userId);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload: JwtPayload = { sub: user.id, username: user.username };
    const accessToken = this.jwtService.sign(payload);

    return { user: this.toSafeUser(user), accessToken };
  }

  /**
   * 验证 JWT Payload 中的用户
   */
  async validateUser(payload: JwtPayload): Promise<Omit<UserRecord, 'passwordHash'> | null> {
    const user = this.users.get(payload.sub);
    if (!user) return null;

    return this.toSafeUser(user);
  }

  /**
   * 根据 ID 获取用户
   */
  getUserById(id: string): Omit<UserRecord, 'passwordHash'> | null {
    const user = this.users.get(id);
    if (!user) return null;

    return this.toSafeUser(user);
  }
}
