import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { UserRecord, JwtPayload, PublicUserProfile, UserRole } from './auth.types';

@Injectable()
export class AuthService {
  // 内存用户存储（V1，后续迁移至数据库）
  private users = new Map<string, UserRecord>();
  private usernameIndex = new Map<string, string>(); // username → userId

  constructor(private readonly jwtService: JwtService) {}

  /** 从 UserRecord 中移除 passwordHash，返回安全用户对象 */
  private toSafeUser(user: UserRecord): PublicUserProfile {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  /**
   * 用户注册
   */
  async register(
    username: string,
    password: string,
    email?: string,
  ): Promise<{ user: PublicUserProfile; accessToken: string }> {
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

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ConflictException('邮箱格式不正确');
      }
    }

    const id = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    // 首个注册用户自动成为 admin
    const role: UserRole = this.users.size === 0 ? 'admin' : 'user';

    const user: UserRecord = {
      id,
      username,
      email,
      role,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        totalScore: 0,
        currentStreak: 0,
      },
    };

    this.users.set(id, user);
    this.usernameIndex.set(username, id);

    const payload: JwtPayload = { sub: id, username, role };
    const accessToken = this.jwtService.sign(payload);

    return { user: this.toSafeUser(user), accessToken };
  }

  /**
   * 用户登录
   */
  async login(username: string, password: string): Promise<{ user: PublicUserProfile; accessToken: string }> {
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

    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return { user: this.toSafeUser(user), accessToken };
  }

  /**
   * 验证 JWT Payload 中的用户
   */
  async validateUser(payload: JwtPayload): Promise<PublicUserProfile | null> {
    const user = this.users.get(payload.sub);
    if (!user) return null;

    return this.toSafeUser(user);
  }

  /**
   * 根据 ID 获取用户（不含密码）
   */
  getUserById(id: string): PublicUserProfile | null {
    const user = this.users.get(id);
    if (!user) return null;

    return this.toSafeUser(user);
  }

  /**
   * 根据 ID 获取完整用户记录（含密码，仅内部使用）
   */
  private getFullUserById(id: string): UserRecord | null {
    return this.users.get(id) || null;
  }

  /**
   * 根据用户名查找用户
   */
  getUserByUsername(username: string): PublicUserProfile | null {
    const userId = this.usernameIndex.get(username);
    if (!userId) return null;
    const user = this.users.get(userId);
    if (!user) return null;
    return this.toSafeUser(user);
  }

  /**
   * 更新用户资料
   */
  async updateProfile(
    userId: string,
    updates: { username?: string; email?: string; avatar?: string },
  ): Promise<PublicUserProfile> {
    const user = this.getFullUserById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (updates.username && updates.username !== user.username) {
      if (updates.username.length < 2 || updates.username.length > 20) {
        throw new ConflictException('用户名需 2-20 个字符');
      }
      if (this.usernameIndex.has(updates.username)) {
        throw new ConflictException('用户名已被使用');
      }
      // 更新用户名索引
      this.usernameIndex.delete(user.username);
      user.username = updates.username;
      this.usernameIndex.set(user.username, userId);
    }

    if (updates.email !== undefined) {
      if (updates.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updates.email)) {
          throw new ConflictException('邮箱格式不正确');
        }
      }
      user.email = updates.email;
    }

    if (updates.avatar !== undefined) {
      user.avatar = updates.avatar;
    }

    user.updatedAt = new Date();
    return this.toSafeUser(user);
  }

  /**
   * 修改密码
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = this.getFullUserById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('当前密码错误');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new ConflictException('新密码至少 6 位');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.updatedAt = new Date();
  }

  /**
   * 注销账号
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = this.getFullUserById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误');
    }

    this.usernameIndex.delete(user.username);
    this.users.delete(userId);
  }

  /**
   * 更新用户统计数据
   */
  updateStats(userId: string, update: Partial<UserRecord['stats']>): PublicUserProfile {
    const user = this.getFullUserById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    user.stats = { ...user.stats, ...update };
    user.updatedAt = new Date();
    return this.toSafeUser(user);
  }

  /**
   * 生成新的 JWT Token
   */
  generateToken(user: PublicUserProfile): string {
    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role };
    return this.jwtService.sign(payload);
  }

  /**
   * 获取所有用户（用于管理功能，V1 简单实现）
   */
  getAllUsers(limit = 100): PublicUserProfile[] {
    const users = [...this.users.values()];
    return users.slice(0, limit).map((u) => this.toSafeUser(u));
  }

  /**
   * 获取用户总数
   */
  getUserCount(): number {
    return this.users.size;
  }

  /**
   * 修改用户角色（仅 admin 可调用）
   */
  setUserRole(userId: string, role: UserRole): PublicUserProfile {
    const user = this.getFullUserById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    user.role = role;
    user.updatedAt = new Date();
    return this.toSafeUser(user);
  }

  /**
   * 管理员重置用户密码
   */
  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    const user = this.getFullUserById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new ConflictException('新密码至少 6 位');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.updatedAt = new Date();
  }

  /**
   * 管理员删除用户
   */
  adminDeleteUser(userId: string): void {
    const user = this.getFullUserById(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    this.usernameIndex.delete(user.username);
    this.users.delete(userId);
  }
}
