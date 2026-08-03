import { Controller, Post, Get, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import type { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface RegisterDto {
  username: string;
  password: string;
}

interface LoginDto {
  username: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto.username, dto.password);
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
}
