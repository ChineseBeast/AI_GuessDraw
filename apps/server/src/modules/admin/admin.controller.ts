import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/guards/admin.guard';

interface ResetPasswordDto {
  newPassword: string;
}

interface SetRoleDto {
  role: 'user' | 'admin';
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── 仪表盘 ────────────────────────────────────

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  async dashboard() {
    return { stats: this.adminService.getDashboardStats() };
  }

  // ─── 用户管理 ──────────────────────────────────

  @Get('users')
  @HttpCode(HttpStatus.OK)
  async listUsers(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const lim = limit ? parseInt(limit, 10) : 100;
    const off = offset ? parseInt(offset, 10) : 0;
    return this.adminService.getUserList(lim, off);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') id: string) {
    this.adminService.deleteUser(id);
    return { success: true };
  }

  @Post('users/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    await this.adminService.resetUserPassword(id, dto.newPassword);
    return { success: true };
  }

  @Patch('users/:id/role')
  @HttpCode(HttpStatus.OK)
  async setRole(@Param('id') id: string, @Body() dto: SetRoleDto) {
    const user = this.adminService.setUserRole(id, dto.role);
    return { user };
  }

  // ─── 房间管理 ──────────────────────────────────

  @Get('rooms')
  @HttpCode(HttpStatus.OK)
  async listRooms() {
    return this.adminService.getRoomList();
  }

  @Delete('rooms/:id')
  @HttpCode(HttpStatus.OK)
  async closeRoom(@Param('id') id: string) {
    this.adminService.closeRoom(id);
    return { success: true };
  }

  // ─── 词库管理 ──────────────────────────────────

  @Get('words')
  @HttpCode(HttpStatus.OK)
  async listWords() {
    return { words: this.adminService.getAllWords() };
  }

  @Post('words')
  @HttpCode(HttpStatus.OK)
  async addWord(@Body() body: { difficulty: string; word: string }) {
    return { words: this.adminService.addWord(body.difficulty, body.word) };
  }

  @Post('words/batch')
  @HttpCode(HttpStatus.OK)
  async addWords(@Body() body: { difficulty: string; words: string[] }) {
    return this.adminService.addWords(body.difficulty, body.words);
  }

  @Delete('words/:difficulty/:word')
  @HttpCode(HttpStatus.OK)
  async removeWord(@Param('difficulty') difficulty: string, @Param('word') word: string) {
    return this.adminService.removeWord(difficulty, decodeURIComponent(word));
  }
}
