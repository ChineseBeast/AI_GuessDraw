import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RoomManagerService } from '../../services/room-manager.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { WordService } from '../../services/word.service';
import type { Difficulty } from '@draw-guess/shared';
import type { DashboardStats, AdminUserList, AdminRoomList } from './admin.types';

@Injectable()
export class AdminService {
  constructor(
    private readonly authService: AuthService,
    private readonly roomManager: RoomManagerService,
    private readonly leaderboardService: LeaderboardService,
    private readonly wordService: WordService,
  ) {}

  /** 仪表盘统计 */
  getDashboardStats(): DashboardStats {
    const users = this.authService.getAllUsers(10000);
    const admins = users.filter((u) => u.role === 'admin').length;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const newToday = users.filter((u) => new Date(u.createdAt) >= todayStart).length;

    const totalPlayed = users.reduce((sum, u) => sum + (u.stats?.gamesPlayed || 0), 0);
    const totalWins = users.reduce((sum, u) => sum + (u.stats?.gamesWon || 0), 0);

    const weeklyBoard = this.leaderboardService.getLeaderboard('weekly', 10000, 0);
    const monthlyBoard = this.leaderboardService.getLeaderboard('monthly', 10000, 0);
    const allTimeBoard = this.leaderboardService.getLeaderboard('all', 10000, 0);

    const rooms = this.roomManager.listAll();
    const playingRooms = rooms.filter((r) => r.status === 'playing').length;
    const waitingRooms = rooms.filter((r) => r.status === 'waiting').length;

    return {
      users: {
        total: users.length,
        admins,
        newToday,
      },
      rooms: {
        active: rooms.length,
        playing: playingRooms,
        waiting: waitingRooms,
      },
      games: {
        totalPlayed,
        totalWins,
      },
      leaderboard: {
        weeklyCount: weeklyBoard.total,
        monthlyCount: monthlyBoard.total,
        allTimeCount: allTimeBoard.total,
      },
    };
  }

  /** 获取用户列表 */
  getUserList(limit = 100, offset = 0): AdminUserList {
    const allUsers = this.authService.getAllUsers(10000);
    const sorted = allUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const paginated = sorted.slice(offset, offset + limit);

    return {
      users: paginated.map((u) => ({
        ...u,
        createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
        updatedAt: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : u.updatedAt,
      })),
      total: allUsers.length,
    };
  }

  /** 获取房间列表 */
  getRoomList(): AdminRoomList {
    const rooms = this.roomManager.listAll();
    return {
      rooms: rooms.map((r) => ({
        id: r.id,
        inviteCode: r.inviteCode,
        hostId: r.hostId,
        status: r.status,
        maxPlayers: r.maxPlayers,
        difficulty: r.difficulty,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        playerCount: r.players.size,
        spectatorCount: r.spectators.size,
      })),
      total: rooms.length,
    };
  }

  /** 强制关闭房间 */
  closeRoom(roomId: string): void {
    this.roomManager.removeRoom(roomId);
  }

  /** 管理员重置用户密码 */
  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    await this.authService.adminResetPassword(userId, newPassword);
  }

  /** 管理员删除用户 */
  deleteUser(userId: string): void {
    this.authService.adminDeleteUser(userId);
  }

  /** 修改用户角色 */
  setUserRole(userId: string, role: 'user' | 'admin') {
    return this.authService.setUserRole(userId, role);
  }

  // ─── 词库管理 ──────────────────────────────────

  /** 获取所有词库 */
  getAllWords() {
    return this.wordService.getAllWords();
  }

  /** 添加词汇 */
  addWord(difficulty: string, word: string) {
    this.wordService.addWord(difficulty as Difficulty, word);
    return this.wordService.getAllWords();
  }

  /** 批量添加词汇 */
  addWords(difficulty: string, words: string[]) {
    const result = this.wordService.addWords(difficulty as Difficulty, words);
    return { ...result, words: this.wordService.getAllWords() };
  }

  /** 删除词汇 */
  removeWord(difficulty: string, word: string) {
    const deleted = this.wordService.removeWord(difficulty as Difficulty, word);
    return { success: deleted, words: this.wordService.getAllWords() };
  }
}
