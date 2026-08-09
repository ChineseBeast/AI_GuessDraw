import { Injectable } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import type { Difficulty } from '@draw-guess/shared';
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH, ROOM_CLEANUP_TIMEOUT } from '@draw-guess/shared';
import type { Room, RoomPlayer } from '../types/websocket.types';
import { AI_PLAYER_ID, AI_PLAYER_NICKNAME } from './ai-player.service';

const generateInviteCode = customAlphabet(INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH);

@Injectable()
export class RoomManagerService {
  private rooms = new Map<string, Room>();
  private inviteCodeIndex = new Map<string, string>(); // inviteCode → roomId
  private cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** 创建房间 */
  createRoom(
    hostId: string,
    hostNickname: string,
    maxPlayers: number,
    difficulty: Difficulty,
    allowAI: boolean = false,
  ): Room {
    const id = this.generateRoomId();
    const inviteCode = this.generateUniqueInviteCode();

    const hostPlayer: RoomPlayer = {
      userId: hostId,
      nickname: hostNickname,
      role: 'guesser',
      score: 0,
      connectionStatus: 'connected',
      joinedAt: new Date(),
      socketId: '',
      sessionToken: this.generateSessionToken(hostId, id),
    };

    const players = new Map<string, RoomPlayer>([[hostId, hostPlayer]]);

    // 房主开启 AI 参与：注入一名 AI 玩家（占一个玩家位，参与画者轮换与计分）
    if (allowAI) {
      const aiPlayer: RoomPlayer = {
        userId: AI_PLAYER_ID,
        nickname: AI_PLAYER_NICKNAME,
        role: 'guesser',
        score: 0,
        connectionStatus: 'connected',
        joinedAt: new Date(),
        socketId: '',
        sessionToken: `ai_${id}`,
        isAI: true,
      };
      players.set(AI_PLAYER_ID, aiPlayer);
    }

    const room: Room = {
      id,
      inviteCode,
      hostId,
      status: 'waiting',
      maxPlayers,
      difficulty,
      allowAI,
      createdAt: new Date(),
      players,
      spectators: new Map(),
    };

    this.rooms.set(id, room);
    this.inviteCodeIndex.set(inviteCode, id);

    return room;
  }

  /** 通过邀请码查找房间 */
  findByInviteCode(inviteCode: string): Room | undefined {
    const roomId = this.inviteCodeIndex.get(inviteCode.toUpperCase());
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  /** 通过 ID 查找房间 */
  findById(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /** 玩家加入房间 */
  joinRoom(
    room: Room,
    userId: string,
    nickname: string,
    socketId: string,
  ): { player: RoomPlayer; isSpectator: boolean } {
    // 检查是否已在房间中
    if (room.players.has(userId) || room.spectators.has(userId)) {
      throw new Error('ALREADY_IN_ROOM');
    }

    const isSpectator = room.status === 'playing';

    const player: RoomPlayer = {
      userId,
      nickname,
      role: isSpectator ? 'spectator' : 'guesser',
      score: 0,
      connectionStatus: 'connected',
      joinedAt: new Date(),
      socketId,
      sessionToken: this.generateSessionToken(userId, room.id),
    };

    if (isSpectator) {
      room.spectators.set(userId, player);
    } else {
      if (room.players.size >= room.maxPlayers) {
        throw new Error('ROOM_FULL');
      }
      room.players.set(userId, player);
    }

    // 清除清理定时器
    this.clearCleanupTimer(room.id);

    return { player, isSpectator };
  }

  /** 玩家离开房间 */
  leaveRoom(roomId: string, userId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    room.players.delete(userId);
    room.spectators.delete(userId);

    // 如果房间空了，启动清理定时器
    if (room.players.size === 0 && room.spectators.size === 0) {
      this.scheduleCleanup(roomId);
      return room;
    }

    // 如果房主离开，转移房主
    if (room.hostId === userId && room.players.size > 0) {
      const newHost = room.players.values().next().value;
      if (newHost) {
        room.hostId = newHost.userId;
      }
    }

    return room;
  }

  /** 更新玩家 Socket ID */
  updatePlayerSocket(roomId: string, userId: string, socketId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(userId) || room.spectators.get(userId);
    if (player) {
      player.socketId = socketId;
    }
  }

  /** 标记玩家断线 */
  markDisconnected(roomId: string, userId: string): RoomPlayer | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const player = room.players.get(userId) || room.spectators.get(userId);
    if (player) {
      player.connectionStatus = 'disconnected';
      player.disconnectedAt = new Date();
    }
    return player;
  }

  /** 标记玩家重连 */
  markReconnected(roomId: string, userId: string, socketId: string): RoomPlayer | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const player = room.players.get(userId) || room.spectators.get(userId);
    if (player) {
      player.connectionStatus = 'connected';
      player.disconnectedAt = undefined;
      player.socketId = socketId;
    }
    return player;
  }

  /** 获取房间内所有玩家（包括观众） */
  getAllPlayers(room: Room): RoomPlayer[] {
    return [...room.players.values(), ...room.spectators.values()];
  }

  /** 获取房间内所有连接的 socket ID */
  getAllSocketIds(room: Room): string[] {
    return this.getAllPlayers(room)
      .filter(p => p.connectionStatus === 'connected' && p.socketId)
      .map(p => p.socketId);
  }

  /** 验证 session token */
  validateSession(roomId: string, userId: string, token: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const player = room.players.get(userId) || room.spectators.get(userId);
    if (!player) return false;

    return player.sessionToken === token;
  }

  /** 删除房间 */
  removeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      this.inviteCodeIndex.delete(room.inviteCode);
    }
    this.rooms.delete(roomId);
    this.clearCleanupTimer(roomId);
  }

  /** 获取所有房间（管理用） */
  listAll(): Room[] {
    return [...this.rooms.values()];
  }

  // ─── Private Helpers ─────────────────────────────

  private generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateUniqueInviteCode(): string {
    let code: string;
    let attempts = 0;
    do {
      code = generateInviteCode();
      attempts++;
      if (attempts > 10) {
        throw new Error('Failed to generate unique invite code');
      }
    } while (this.inviteCodeIndex.has(code));
    return code;
  }

  private generateSessionToken(userId: string, roomId: string): string {
    return `${roomId}_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private scheduleCleanup(roomId: string): void {
    const timer = setTimeout(() => {
      this.removeRoom(roomId);
    }, ROOM_CLEANUP_TIMEOUT);
    this.cleanupTimers.set(roomId, timer);
  }

  private clearCleanupTimer(roomId: string): void {
    const timer = this.cleanupTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(roomId);
    }
  }
}
