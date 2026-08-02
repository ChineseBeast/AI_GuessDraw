import type {
  OnGatewayConnection,
  OnGatewayDisconnect} from '@nestjs/websockets';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { COUNTDOWN_DURATION, ROUND_RESULT_DURATION, MAX_RECONNECT_TIME } from '@draw-guess/shared';
import type { RoomManagerService } from '../services/room-manager.service';
import type { GameEngineService } from '../services/game-engine.service';
import type { WordService } from '../services/word.service';
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  CanvasActionPayload,
  SubmitGuessPayload,
  ReconnectPayload,
  RoomCreatedResponse,
  RoomJoinedResponse,
  PlayerInfo,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  PlayerDisconnectedEvent,
  PlayerReconnectedEvent,
  HostChangedEvent,
  GameStartedEvent,
  RoundStartedForDrawer,
  RoundStartedForGuessers,
  CanvasSyncEvent,
  GuessResultEvent,
  CorrectGuessEvent,
  RoundEndedEvent,
  GameEndedEvent,
  ErrorEvent,
} from '../types/websocket.types';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/',
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RoomGateway.name);
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private socketToUser = new Map<string, { userId: string; roomId: string }>();

  constructor(
    private readonly roomManager: RoomManagerService,
    private readonly gameEngine: GameEngineService,
    private readonly wordService: WordService,
  ) {}

  // ─── Lifecycle ───────────────────────────────────

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    const mapping = this.socketToUser.get(client.id);
    if (!mapping) return;

    const { userId, roomId } = mapping;
    const room = this.roomManager.findById(roomId);
    if (!room) return;

    const player = this.roomManager.markDisconnected(roomId, userId);
    if (!player) return;

    // 广播断线事件
    const event: PlayerDisconnectedEvent = {
      playerId: userId,
      nickname: player.nickname,
      disconnectedAt: new Date().toISOString(),
      reconnectDeadline: new Date(Date.now() + MAX_RECONNECT_TIME * 1000).toISOString(),
    };
    this.server.to(roomId).emit('player_disconnected', event);

    // 设置断线超时
    const timerKey = `${roomId}_${userId}`;
    const timer = setTimeout(() => {
      this.handleDisconnectTimeout(roomId, userId);
    }, MAX_RECONNECT_TIME * 1000);
    this.disconnectTimers.set(timerKey, timer);
  }

  // ─── Room Events ─────────────────────────────────

  @SubscribeMessage('create_room')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateRoomPayload,
  ): void {
    try {
      const userId = this.getUserId(client);
      const nickname = this.getNickname(client);

      // 验证参数
      if (!payload.maxPlayers || payload.maxPlayers < 4 || payload.maxPlayers > 8) {
        this.sendError(client, 'INVALID_ACTION', 'maxPlayers must be between 4 and 8');
        return;
      }

      const room = this.roomManager.createRoom(userId, nickname, payload.maxPlayers, payload.difficulty || 'medium');

      // 更新房主的 socketId
      this.roomManager.updatePlayerSocket(room.id, userId, client.id);
      this.socketToUser.set(client.id, { userId, roomId: room.id });

      // 加入 Socket.IO 房间
      client.join(room.id);

      const response: RoomCreatedResponse = {
        roomId: room.id,
        inviteCode: room.inviteCode,
        hostId: room.hostId,
        maxPlayers: room.maxPlayers,
        difficulty: room.difficulty,
        players: this.mapPlayers(room),
      };

      client.emit('room_created', response);
      this.logger.log(`Room created: ${room.inviteCode} by ${nickname}`);
    } catch (error) {
      this.sendError(client, 'INTERNAL_ERROR', (error as Error).message);
    }
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ): void {
    try {
      const userId = this.getUserId(client);
      const nickname = this.getNickname(client);

      const room = this.roomManager.findByInviteCode(payload.inviteCode);
      if (!room) {
        this.sendError(client, 'ROOM_NOT_FOUND', 'Room not found or expired');
        return;
      }

      const { player } = this.roomManager.joinRoom(room, userId, nickname, client.id);
      this.socketToUser.set(client.id, { userId, roomId: room.id });
      client.join(room.id);

      const response: RoomJoinedResponse = {
        roomId: room.id,
        inviteCode: room.inviteCode,
        hostId: room.hostId,
        maxPlayers: room.maxPlayers,
        difficulty: room.difficulty,
        players: this.mapPlayers(room),
        status: room.status,
      };

      client.emit('room_joined', response);

      // 广播给其他玩家
      const joinEvent: PlayerJoinedEvent = {
        player: this.mapSinglePlayer(player),
        playerCount: room.players.size,
        maxPlayers: room.maxPlayers,
      };
      client.to(room.id).emit('player_joined', joinEvent);

      this.logger.log(`${nickname} joined room ${room.inviteCode} as ${player.role}`);
    } catch (error) {
      const msg = (error as Error).message;
      if (msg === 'ALREADY_IN_ROOM') {
        this.sendError(client, 'ALREADY_IN_ROOM', 'You are already in this room');
      } else if (msg === 'ROOM_FULL') {
        this.sendError(client, 'ROOM_FULL', 'Room is full');
      } else {
        this.sendError(client, 'INTERNAL_ERROR', msg);
      }
    }
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() client: Socket): void {
    const mapping = this.socketToUser.get(client.id);
    if (!mapping) return;

    const { userId, roomId } = mapping;
    const room = this.roomManager.leaveRoom(roomId, userId);
    if (!room) return;

    client.leave(roomId);
    this.socketToUser.delete(client.id);

    // 广播离开事件
    const player = room.players.get(userId) || room.spectators.get(userId);
    const event: PlayerLeftEvent = {
      playerId: userId,
      nickname: player?.nickname || 'Unknown',
      playerCount: room.players.size,
      reason: 'voluntary',
    };
    this.server.to(roomId).emit('player_left', event);

    // 如果房主变更了
    if (room.players.size > 0 && !room.players.has(room.hostId)) {
      // 房主已在 leaveRoom 中转移
    }
  }

  // ─── Game Events ─────────────────────────────────

  @SubscribeMessage('start_game')
  handleStartGame(@ConnectedSocket() client: Socket): void {
    const mapping = this.socketToUser.get(client.id);
    if (!mapping) return;

    const { userId, roomId } = mapping;
    const room = this.roomManager.findById(roomId);
    if (!room) return;

    // 验证房主
    if (room.hostId !== userId) {
      this.sendError(client, 'NOT_HOST', 'Only the host can start the game');
      return;
    }

    // 验证最少玩家数
    if (room.players.size < 2) {
      this.sendError(client, 'NOT_ENOUGH_PLAYERS', 'At least 2 players required');
      return;
    }

    // 验证状态
    if (room.status !== 'waiting') {
      this.sendError(client, 'GAME_ALREADY_STARTED', 'Game has already started');
      return;
    }

    room.status = 'playing';

    // 初始化游戏
    const game = this.gameEngine.initGame(room, this.wordService);

    // 广播游戏开始
    const startedEvent: GameStartedEvent = {
      totalRounds: game.totalRounds,
      drawerOrder: game.drawerOrder,
      firstDrawerIndex: 0,
      countdown: 3,
    };
    this.server.to(roomId).emit('game_started', startedEvent);

    // 3 秒倒计时后开始第一轮
    setTimeout(() => {
      this.startNextRound(roomId);
    }, COUNTDOWN_DURATION);
  }

  @SubscribeMessage('canvas_action')
  handleCanvasAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CanvasActionPayload,
  ): void {
    const mapping = this.socketToUser.get(client.id);
    if (!mapping) return;

    const { userId, roomId } = mapping;
    const game = this.gameEngine.getGame(roomId);
    if (!game || game.status !== 'playing') return;

    const round = game.rounds[game.currentRound - 1];
    if (!round || round.status !== 'active') return;

    // 验证是绘画者
    if (round.drawerId !== userId) return;

    // 分配序列号并存储
    const sequenceNumber = round.strokes.length + 1;
    const syncEvent: CanvasSyncEvent = {
      sequenceNumber,
      type: payload.type,
      brush: payload.brush,
      points: payload.points,
      timestamp: Date.now(),
    };
    round.strokes.push(syncEvent);

    // 广播给所有非绘画者（包括观众）
    client.to(roomId).emit('canvas_sync', syncEvent);

    // 也发送给观众
    const room = this.roomManager.findById(roomId);
    if (room) {
      for (const spectator of room.spectators.values()) {
        if (spectator.connectionStatus === 'connected' && spectator.socketId) {
          this.server.to(spectator.socketId).emit('canvas_sync', syncEvent);
        }
      }
    }
  }

  @SubscribeMessage('submit_guess')
  handleSubmitGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubmitGuessPayload,
  ): void {
    const mapping = this.socketToUser.get(client.id);
    if (!mapping) return;

    const { userId, roomId } = mapping;
    const game = this.gameEngine.getGame(roomId);
    if (!game || game.status !== 'playing') return;

    const round = game.rounds[game.currentRound - 1];
    if (!round || round.status !== 'active') return;

    // 绘画者不能猜词
    if (round.drawerId === userId) return;

    // 已猜对的不重复处理
    if (round.guesses.some(g => g.playerId === userId && g.isCorrect)) return;

    const { guess, guesserRank, allGuessed } = this.gameEngine.processGuess(
      game, round, userId, payload.text, this.wordService,
    );

    // 回复猜词者
    const resultEvent: GuessResultEvent = {
      isCorrect: guess.isCorrect,
      proximity: guess.proximity,
      score: guess.score,
      rank: guesserRank ?? undefined,
    };
    client.emit('guess_result', resultEvent);

    // 如果猜对了，广播
    if (guess.isCorrect && guesserRank) {
      const correctEvent: CorrectGuessEvent = {
        playerId: userId,
        nickname: this.getPlayerNickname(roomId, userId),
        rank: guesserRank,
        score: guess.score,
        guessersRemaining: game.drawerOrder.filter(id => id !== round.drawerId).length - round.guesses.filter(g => g.isCorrect).length,
      };
      this.server.to(roomId).emit('correct_guess', correctEvent);
    }

    // 全员猜对 → 结束轮次
    if (allGuessed) {
      this.gameEngine.endRound(game, round, 'all_guessed');
      this.broadcastRoundEnd(roomId);
    }
  }

  @SubscribeMessage('reconnect')
  handleReconnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ReconnectPayload,
  ): void {
    const userId = this.getUserId(client);

    // 验证 session
    if (!this.roomManager.validateSession(payload.roomId, userId, payload.sessionToken)) {
      this.sendError(client, 'SESSION_EXPIRED', 'Session expired or invalid');
      return;
    }

    const room = this.roomManager.findById(payload.roomId);
    if (!room) {
      this.sendError(client, 'ROOM_NOT_FOUND', 'Room not found');
      return;
    }

    // 标记重连
    const player = this.roomManager.markReconnected(payload.roomId, userId, client.id);
    if (!player) return;

    this.socketToUser.set(client.id, { userId, roomId: room.id });
    client.join(room.id);

    // 清除断线定时器
    const timerKey = `${room.id}_${userId}`;
    const timer = this.disconnectTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(timerKey);
    }

    // 广播重连
    const event: PlayerReconnectedEvent = {
      playerId: userId,
      nickname: player.nickname,
    };
    this.server.to(room.id).emit('player_reconnected', event);

    // 发送当前游戏状态快照
    const game = this.gameEngine.getGame(room.id);
    if (game && (game.status === 'playing' || game.status === 'round_end')) {
      const round = game.rounds[game.currentRound - 1];
      if (round) {
        // 发送完整游戏状态给重连的玩家
        const isDrawer = round.drawerId === userId;
        client.emit('game_state_sync', {
          gameStatus: game.status,
          currentRound: game.currentRound,
          totalRounds: game.totalRounds,
          isDrawer,
          targetWord: isDrawer ? round.targetWord : undefined,
          wordLength: isDrawer ? undefined : round.targetWord.length,
          wordHint: isDrawer ? undefined : '_'.repeat(round.targetWord.length),
          timeLimit: 60,
          scores: this.getCurrentScores(room.id),
          correctGuessers: round.guesses.filter(g => g.isCorrect).map(g => ({
            playerId: g.playerId,
            nickname: this.getPlayerNickname(room.id, g.playerId),
          })),
        });

        // 发送画布操作回放
        for (const stroke of round.strokes) {
          client.emit('canvas_sync', stroke);
        }
      }
    }

    this.logger.log(`${player.nickname} reconnected to room ${room.inviteCode}`);
  }

  @SubscribeMessage('join_as_spectator')
  handleJoinAsSpectator(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ): void {
    try {
      const userId = this.getUserId(client);
      const nickname = this.getNickname(client);

      const room = this.roomManager.findByInviteCode(payload.inviteCode);
      if (!room) {
        this.sendError(client, 'ROOM_NOT_FOUND', 'Room not found or expired');
        return;
      }

      // 强制以观众身份加入
      const { player } = this.roomManager.joinRoom(room, userId, nickname, client.id);
      // 覆盖角色为 spectator
      player.role = 'spectator';

      this.socketToUser.set(client.id, { userId, roomId: room.id });
      client.join(room.id);

      // 发送房间快照
      const game = this.gameEngine.getGame(room.id);
      client.emit('spectator_joined', {
        roomId: room.id,
        inviteCode: room.inviteCode,
        players: this.mapPlayers(room),
        currentRound: game?.currentRound ?? 0,
        totalRounds: game?.totalRounds ?? 0,
        gameStatus: game?.status ?? 'waiting',
        scores: game ? this.getCurrentScores(room.id) : {},
      });

      // 广播给其他玩家
      const joinEvent: PlayerJoinedEvent = {
        player: this.mapSinglePlayer(player),
        playerCount: room.players.size,
        maxPlayers: room.maxPlayers,
      };
      client.to(room.id).emit('player_joined', joinEvent);

      this.logger.log(`${nickname} joined as spectator in room ${room.inviteCode}`);
    } catch (error) {
      const msg = (error as Error).message;
      if (msg === 'ALREADY_IN_ROOM') {
        this.sendError(client, 'ALREADY_IN_ROOM', 'You are already in this room');
      } else {
        this.sendError(client, 'INTERNAL_ERROR', msg);
      }
    }
  }

  @SubscribeMessage('accept_join_next_game')
  handleAcceptJoinNextGame(@ConnectedSocket() client: Socket): void {
    const mapping = this.socketToUser.get(client.id);
    if (!mapping) return;

    const { userId, roomId } = mapping;
    const room = this.roomManager.findById(roomId);
    if (!room) return;

    const spectator = room.spectators.get(userId);
    if (!spectator) return;

    // 检查房间是否已满
    if (room.players.size >= room.maxPlayers) {
      this.sendError(client, 'ROOM_FULL', 'Room is now full, please wait for next game');
      return;
    }

    // 从观众转为玩家
    room.spectators.delete(userId);
    spectator.role = 'guesser';
    room.players.set(userId, spectator);

    client.emit('role_changed', { newRole: 'guesser' });

    // 广播给其他玩家
    const joinEvent: PlayerJoinedEvent = {
      player: this.mapSinglePlayer(spectator),
      playerCount: room.players.size,
      maxPlayers: room.maxPlayers,
    };
    this.server.to(roomId).emit('player_joined', joinEvent);

    this.logger.log(`${spectator.nickname} converted from spectator to player`);
  }

  // ─── Private Helpers ─────────────────────────────

  private startNextRound(roomId: string): void {
    const game = this.gameEngine.getGame(roomId);
    if (!game) return;

    const room = this.roomManager.findById(roomId);
    if (!room) return;

    const round = this.gameEngine.startRound(game, this.wordService);
    // drawer will be used for role assignment below

    // 发给绘画者
    const socketIds = this.roomManager.getAllSocketIds(room);
    for (const socketId of socketIds) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (!socket) continue;

      const mapping = this.socketToUser.get(socketId);
      if (!mapping) continue;

      if (mapping.userId === round.drawerId) {
        const event: RoundStartedForDrawer = {
          roundNumber: round.roundNumber,
          targetWord: round.targetWord,
          difficulty: round.wordDifficulty,
          timeLimit: 60,
        };
        socket.emit('round_started', event);
      } else {
        const event: RoundStartedForGuessers = {
          roundNumber: round.roundNumber,
          wordLength: round.targetWord.length,
          wordHint: '_'.repeat(round.targetWord.length),
          timeLimit: 60,
        };
        socket.emit('round_started', event);
      }
    }
  }

  private broadcastRoundEnd(roomId: string): void {
    const game = this.gameEngine.getGame(roomId);
    if (!game) return;

    const room = this.roomManager.findById(roomId);
    if (!room) return;

    const round = game.rounds[game.currentRound - 1];
    if (!round) return;

    const drawerScore = this.gameEngine.calculateDrawerScore(round);
    const drawer = room.players.get(round.drawerId);
    if (drawer) {
      drawer.score += drawerScore;
    }

    // 更新猜对者分数
    for (const guess of round.guesses) {
      if (guess.isCorrect) {
        const player = room.players.get(guess.playerId);
        if (player) {
          player.score += guess.score;
        }
      }
    }

    // 计算累计分数
    const scores: Record<string, number> = {};
    const totalScores: Record<string, number> = {};
    for (const player of room.players.values()) {
      totalScores[player.userId] = player.score;
    }
    for (const guess of round.guesses) {
      if (guess.isCorrect) {
        scores[guess.playerId] = guess.score;
      }
    }
    scores[round.drawerId] = drawerScore;

    const hasNext = game.currentRound < game.totalRounds && game.currentDrawerIndex + 1 < game.drawerOrder.length;
    const nextDrawerId = hasNext ? game.drawerOrder[game.currentDrawerIndex + 1] : undefined;

    const event: RoundEndedEvent = {
      roundNumber: round.roundNumber,
      targetWord: round.targetWord,
      drawerId: round.drawerId,
      drawerNickname: drawer?.nickname || 'Unknown',
      drawerScore,
      scores,
      totalScores,
      endReason: round.endedAt ? 'all_guessed' : 'timeout',
      nextDrawerId,
    };
    this.server.to(roomId).emit('round_ended', event);

    // 3 秒后推进
    setTimeout(() => {
      const hasMore = this.gameEngine.advanceToNextRound(game);
      if (hasMore) {
        this.startNextRound(roomId);
      } else {
        this.broadcastGameEnd(roomId);
      }
    }, ROUND_RESULT_DURATION);
  }

  private broadcastGameEnd(roomId: string): void {
    const game = this.gameEngine.getGame(roomId);
    if (!game) return;

    const room = this.roomManager.findById(roomId);
    if (!room) return;

    const finalScores = this.gameEngine.getFinalScores(game, room);

    const roundsSummary = game.rounds.map(r => ({
      roundNumber: r.roundNumber,
      targetWord: r.targetWord,
      drawer: room.players.get(r.drawerId)?.nickname || 'Unknown',
      correctGuessers: r.guesses.filter(g => g.isCorrect).map(g => room.players.get(g.playerId)?.nickname || 'Unknown'),
    }));

    const event: GameEndedEvent = { finalScores, roundsSummary };
    this.server.to(roomId).emit('game_ended', event);

    // 重置房间状态
    room.status = 'waiting';
    for (const player of room.players.values()) {
      player.score = 0;
      player.role = 'guesser';
    }

    // 提示观众可以加入下一局，并将观众转为玩家
    if (room.spectators.size > 0) {
      const spectatorIds = [...room.spectators.keys()];
      for (const sid of spectatorIds) {
        const spectator = room.spectators.get(sid);
        if (spectator) {
          // 广播给观众：询问是否加入下一局
          const spectatorSocket = this.server.sockets.sockets.get(spectator.socketId);
          if (spectatorSocket) {
            spectatorSocket.emit('join_next_game_prompt', {
              message: '游戏已结束，是否加入下一局？',
            });
          }
        }
      }
    }

    this.gameEngine.removeGame(roomId);
    this.logger.log(`Game ended in room ${room.inviteCode}`);
  }

  private handleDisconnectTimeout(roomId: string, userId: string): void {
    const room = this.roomManager.findById(roomId);
    if (!room) return;

    const player = room.players.get(userId) || room.spectators.get(userId);
    if (!player || player.connectionStatus === 'connected') return;

    // 如果是绘画者断线
    const game = this.gameEngine.getGame(roomId);
    if (game && game.status === 'playing') {
      const round = game.rounds[game.currentRound - 1];
      if (round && round.drawerId === userId && round.status === 'active') {
        // 切换到下一个玩家
        const remainingPlayers = [...room.players.keys()].filter(id => id !== userId);
        if (remainingPlayers.length > 0) {
          const newDrawer = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)];
          this.gameEngine.switchDrawer(game, round, newDrawer);
          this.server.to(roomId).emit('player_left', {
            playerId: userId,
            nickname: player.nickname,
            playerCount: room.players.size - 1,
            reason: 'timeout',
          });
        }
      }
    }

    // 移除玩家
    this.roomManager.leaveRoom(roomId, userId);

    // 如果房主断线
    if (room.hostId === userId && room.players.size > 0) {
      const newHost = room.players.values().next().value;
      if (newHost) {
        room.hostId = newHost.userId;
        const hostEvent: HostChangedEvent = {
          oldHostId: userId,
          newHostId: newHost.userId,
          newHostNickname: newHost.nickname,
        };
        this.server.to(roomId).emit('host_changed', hostEvent);
      }
    }

    const leaveEvent: PlayerLeftEvent = {
      playerId: userId,
      nickname: player.nickname,
      playerCount: room.players.size,
      reason: 'timeout',
    };
    this.server.to(roomId).emit('player_left', leaveEvent);
  }

  private getCurrentScores(roomId: string): Record<string, number> {
    const room = this.roomManager.findById(roomId);
    if (!room) return {};
    const scores: Record<string, number> = {};
    for (const player of room.players.values()) {
      scores[player.userId] = player.score;
    }
    return scores;
  }

  private sendError(client: Socket, code: string, message: string): void {
    const event: ErrorEvent = { code, message };
    client.emit('error', event);
  }

  private getUserId(client: Socket): string {
    // 从 Socket.IO handshake auth 中获取用户 ID
    return (client.handshake.auth?.userId as string) || `user_${client.id.substring(0, 8)}`;
  }

  private getNickname(client: Socket): string {
    return (client.handshake.auth?.nickname as string) || `Player_${client.id.substring(0, 4)}`;
  }

  private getPlayerNickname(roomId: string, userId: string): string {
    const room = this.roomManager.findById(roomId);
    if (!room) return 'Unknown';
    const player = room.players.get(userId) || room.spectators.get(userId);
    return player?.nickname || 'Unknown';
  }

  private mapPlayers(room: { players: Map<string, { userId: string; nickname: string; avatarUrl?: string; role: string; score: number; connectionStatus: string }> }): PlayerInfo[] {
    return [...room.players.values()].map(p => ({
      userId: p.userId,
      nickname: p.nickname,
      avatarUrl: p.avatarUrl,
      role: p.role as PlayerInfo['role'],
      score: p.score,
      connectionStatus: p.connectionStatus as PlayerInfo['connectionStatus'],
    }));
  }

  private mapSinglePlayer(p: { userId: string; nickname: string; avatarUrl?: string; role: string; score: number; connectionStatus: string }): PlayerInfo {
    return {
      userId: p.userId,
      nickname: p.nickname,
      avatarUrl: p.avatarUrl,
      role: p.role as PlayerInfo['role'],
      score: p.score,
      connectionStatus: p.connectionStatus as PlayerInfo['connectionStatus'],
    };
  }
}
