import { Controller, Post, Get, Patch, Delete, Body, UseGuards, Request, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface RegisterDto {
  username: string;
  password: string;
  email?: string;
}

interface LoginDto {
  username: string;
  password: string;
}

interface UpdateProfileDto {
  username?: string;
  email?: string;
  avatar?: string;
}

interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

interface DeleteAccountDto {
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto.username, dto.password, dto.email);
    return {
      user: result.user,
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn: 86400, // 24 hours
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.username, dto.password);
    return {
      user: result.user,
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn: 86400,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async me(@Request() req: { user: { userId: string; username: string } }) {
    const user = this.authService.getUserById(req.user.userId);
    if (!user) {
      return { error: 'User not found' };
    }
    return { user };
  }

  // ─── 用户管理端点（需认证） ────────────────────

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Request() req: { user: { userId: string; username: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.authService.updateProfile(req.user.userId, dto);
    return { user };
  }

  @Post('me/change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: { user: { userId: string; username: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(req.user.userId, dto.currentPassword, dto.newPassword);
    return { success: true };
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @Request() req: { user: { userId: string; username: string } },
    @Body() dto: DeleteAccountDto,
  ) {
    await this.authService.deleteAccount(req.user.userId, dto.password);
    return { success: true };
  }

  // ─── 用户查询端点（公开） ──────────────────────

  @Get('profile/:id')
  @HttpCode(HttpStatus.OK)
  async getUserById(@Param('id') id: string) {
    const user = this.authService.getUserById(id);
    if (!user) {
      return { error: 'User not found' };
    }
    return { user };
  }

  @Get('profile/username/:username')
  @HttpCode(HttpStatus.OK)
  async getUserByUsername(@Param('username') username: string) {
    const user = this.authService.getUserByUsername(username);
    if (!user) {
      return { error: 'User not found' };
    }
    return { user };
  }
}
