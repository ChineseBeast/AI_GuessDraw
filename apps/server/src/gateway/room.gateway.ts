import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { COUNTDOWN_DURATION, ROUND_RESULT_DURATION, MAX_RECONNECT_TIME, ROUND_DURATION } from '@draw-guess/shared';
import { RoomManagerService } from '../services/room-manager.service';
import { GameEngineService } from '../services/game-engine.service';
import { WordService } from '../services/word.service';
import {
  AIPlayerService,
  AI_PLAYER_ID,
  AI_PLAYER_NICKNAME,
  AI_GUESS_INTERVAL_MS,
  AI_DRAW_EXTRA_MS,
} from '../services/ai-player.service';
import type { JwtPayload } from '../modules/auth/auth.types';
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
  AIStatusEvent,
  AIGuessEvent,
  DrawerFinishedEvent,
} from '../types/websocket.types';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  namespace: '/',
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RoomGateway.name);
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private socketToUser = new Map<string, { userId: string; roomId: string }>();
  /** AI 猜词循环状态：roomId → 循环上下文（每轮重建，防止旧循环残留） */
  private aiGuessLoops = new Map<
    string,
    { timer: ReturnType<typeof setTimeout> | null; inFlight: boolean; lastAttemptAt: number }
  >();

  constructor(
    private readonly roomManager: RoomManagerService,
    private readonly gameEngine: GameEngineService,
    private readonly wordService: WordService,
    private readonly jwtService: JwtService,
    private readonly aiPlayerService: AIPlayerService,
  ) {}

  // ─── Lifecycle ───────────────────────────────────

  handleConnection(client: Socket): void {
    // 使用 JWT 验证连接（内联 WsAuthGuard 逻辑）
    const token = this.extractToken(client);
    if (token) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(token);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client as any).userId = payload.sub;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client as any).username = payload.username;
        this.logger.debug(`WS authenticated: ${payload.username} (${client.id})`);
      } catch {
        this.logger.warn(`WS invalid token from client: ${client.id}`);
      }
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * 从客户端连接中提取 Token
   */
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
  handleCreateRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: CreateRoomPayload): void {
    try {
      const userId = this.getUserId(client);
      const nickname = this.getNickname(client);

      // 验证参数
      if (!payload.maxPlayers || payload.maxPlayers < 4 || payload.maxPlayers > 8) {
        this.sendError(client, 'INVALID_ACTION', 'maxPlayers must be between 4 and 8');
        return;
      }

      const room = this.roomManager.createRoom(
        userId,
        nickname,
        payload.maxPlayers,
        payload.difficulty || 'medium',
        payload.allowAI,
      );

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
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinRoomPayload): void {
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
  handleCanvasAction(@ConnectedSocket() client: Socket, @MessageBody() payload: CanvasActionPayload): void {
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

  @SubscribeMessage('finish_drawing')
  handleFinishDrawing(@ConnectedSocket() client: Socket): void {
    const mapping = this.socketToUser.get(client.id);
    if (!mapping) return;

    const { userId, roomId } = mapping;
    const game = this.gameEngine.getGame(roomId);
    if (!game || game.status !== 'playing') return;

    const round = game.rounds[game.currentRound - 1];
    if (!round || round.status !== 'active') return;

    // 验证是绘画者
    if (round.drawerId !== userId) return;

    const room = this.roomManager.findById(roomId);

    // AI 参与的房间：提交绘画后本轮继续，给 AI（及其他人）猜词时间，直到超时或全员猜对
    if (room?.allowAI && room.players.has(AI_PLAYER_ID)) {
      const event: DrawerFinishedEvent = { drawerId: userId };
      this.server.to(roomId).emit('drawer_finished', event);
      this.logger.log(`Drawer ${userId} submitted drawing in AI room ${roomId}, round continues`);
      return;
    }

    // 结束当前轮次
    this.gameEngine.endRound(game, round, 'drawer_submitted');
    this.broadcastRoundEnd(roomId);

    this.logger.log(`Drawer ${userId} submitted drawing in room ${roomId}`);
  }

  @SubscribeMessage('submit_guess')
  handleSubmitGuess(@ConnectedSocket() client: Socket, @MessageBody() payload: SubmitGuessPayload): void {
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
    if (round.guesses.some((g) => g.playerId === userId && g.isCorrect)) return;

    const { guess, guesserRank, allGuessed } = this.gameEngine.processGuess(
      game,
      round,
      userId,
      payload.text,
      this.wordService,
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
        guessersRemaining:
          game.drawerOrder.filter((id) => id !== round.drawerId).length -
          round.guesses.filter((g) => g.isCorrect).length,
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
  handleReconnect(@ConnectedSocket() client: Socket, @MessageBody() payload: ReconnectPayload): void {
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
          timeLimit: Math.round((round.durationMs || 60_000) / 1000),
          scores: this.getCurrentScores(room.id),
          correctGuessers: round.guesses
            .filter((g) => g.isCorrect)
            .map((g) => ({
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
  handleJoinAsSpectator(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinRoomPayload): void {
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

    // 本轮绘画者是否为 AI（AI 绘画需要先生成笔画，延长本轮时长）
    const drawerId = game.drawerOrder[game.currentDrawerIndex % game.drawerOrder.length];
    const isAIDrawer = drawerId === AI_PLAYER_ID;
    const roundDurationMs = isAIDrawer ? ROUND_DURATION + AI_DRAW_EXTRA_MS : ROUND_DURATION;

    const round = this.gameEngine.startRound(game, this.wordService, roundDurationMs, () => {
      // 超时结束：广播轮次结果并推进（AI 房画者提交后轮次继续，超时是常见结束路径）
      this.broadcastRoundEnd(roomId);
    });

    // 同步玩家角色（画者/猜词者），供玩家列表展示
    for (const player of room.players.values()) {
      player.role = player.userId === round.drawerId ? 'drawer' : 'guesser';
    }

    // 发给每个玩家（使用 server.to(socketId) 避免访问 server.sockets.sockets）
    const socketIds = this.roomManager.getAllSocketIds(room);
    for (const socketId of socketIds) {
      const mapping = this.socketToUser.get(socketId);
      if (!mapping) continue;

      if (mapping.userId === round.drawerId) {
        const event: RoundStartedForDrawer = {
          roundNumber: round.roundNumber,
          drawerId: round.drawerId,
          targetWord: round.targetWord,
          difficulty: round.wordDifficulty,
          timeLimit: Math.round(round.durationMs / 1000),
        };
        this.server.to(socketId).emit('round_started', event);
      } else {
        const event: RoundStartedForGuessers = {
          roundNumber: round.roundNumber,
          drawerId: round.drawerId,
          wordLength: round.targetWord.length,
          wordHint: '_'.repeat(round.targetWord.length),
          timeLimit: Math.round(round.durationMs / 1000),
        };
        this.server.to(socketId).emit('round_started', event);
      }
    }

    // AI 参与：本轮为 AI 作画则驱动 AI 生成笔画，否则（AI 是猜者）启动 AI 猜词循环
    if (room.allowAI && room.players.has(AI_PLAYER_ID)) {
      if (isAIDrawer) {
        this.kickoffAIDrawing(roomId);
      } else {
        this.startAIGuessLoop(roomId);
      }
    }
  }

  /**
   * AI 作为画者：调用 ai-service 生成笔画轨迹，并以 canvas_sync 事件广播给所有玩家。
   * 生成失败（AI 服务不可用）时按超时结束本轮。
   */
  private kickoffAIDrawing(roomId: string): void {
    const game = this.gameEngine.getGame(roomId);
    const round = game?.rounds[game.currentRound - 1];
    if (!game || !round || round.status !== 'active' || round.drawerId !== AI_PLAYER_ID) return;

    const statusEvent: AIStatusEvent = { playerId: AI_PLAYER_ID, status: 'drawing' };
    this.server.to(roomId).emit('ai_status', statusEvent);
    this.logger.log(`AI drawing round ${round.roundNumber} started in room ${roomId}`);

    this.aiPlayerService
      .generateStrokes(round.targetWord, round.wordDifficulty)
      .then((strokes) => {
        // 轮次可能已结束/切换，丢弃过期结果
        const current = this.gameEngine.getGame(roomId);
        const currentRound = current?.rounds[current.currentRound - 1];
        if (!current || !currentRound || currentRound !== round || currentRound.status !== 'active') return;

        for (const stroke of strokes) {
          const syncEvent: CanvasSyncEvent = {
            sequenceNumber: currentRound.strokes.length + 1,
            type: 'draw',
            brush: { color: stroke.color, size: stroke.width, opacity: 1 },
            points: stroke.points,
            timestamp: Date.now(),
          };
          currentRound.strokes.push(syncEvent);
          this.server.to(roomId).emit('canvas_sync', syncEvent);
        }

        const doneEvent: AIStatusEvent = { playerId: AI_PLAYER_ID, status: 'draw_done' };
        this.server.to(roomId).emit('ai_status', doneEvent);
        this.logger.log(`AI finished drawing round ${round.roundNumber} in room ${roomId}`);
      })
      .catch(() => {
        // AI 服务不可用：按超时结束本轮，避免卡住
        const current = this.gameEngine.getGame(roomId);
        const currentRound = current?.rounds[current.currentRound - 1];
        if (!current || !currentRound || currentRound !== round || currentRound.status !== 'active') return;

        this.logger.warn(`AI drawing failed in room ${roomId}, ending round ${round.roundNumber}`);
        this.gameEngine.endRound(current, currentRound, 'timeout');
        this.broadcastRoundEnd(roomId);
      });
  }

  /**
   * AI 作为猜者：启动猜词循环。每隔 AI_GUESS_INTERVAL_MS 检查一次画布是否有笔画，
   * 有则调用 ai-service 识别并精确匹配目标词；猜对即停止，直到本轮结束。
   * 两次猜测之间至少间隔 AI_GUESS_INTERVAL_MS。
   */
  private startAIGuessLoop(roomId: string): void {
    // 重建循环上下文，使旧循环自然失效
    this.stopAIGuessLoop(roomId);
    const state = { timer: null as ReturnType<typeof setTimeout> | null, inFlight: false, lastAttemptAt: 0 };
    this.aiGuessLoops.set(roomId, state);

    const tick = async () => {
      // 循环上下文已被替换（新一轮）或房间已结束 → 停止
      if (this.aiGuessLoops.get(roomId) !== state) return;

      const game = this.gameEngine.getGame(roomId);
      const room = this.roomManager.findById(roomId);
      if (!game || game.status !== 'playing' || !room || !room.players.has(AI_PLAYER_ID)) return;

      const round = game.rounds[game.currentRound - 1];
      if (!round || round.status !== 'active' || round.drawerId === AI_PLAYER_ID) return;
      // AI 已猜对 → 停止（与人类玩家一致：猜对后不再处理）
      if (round.guesses.some((g) => g.playerId === AI_PLAYER_ID && g.isCorrect)) return;

      const now = Date.now();
      const hasStrokes = round.strokes.some((s) => s.type === 'draw' || s.type === 'erase');
      const intervalOk = now - state.lastAttemptAt >= AI_GUESS_INTERVAL_MS;

      if (!hasStrokes || state.inFlight || !intervalOk) {
        this.scheduleAIGuessTick(state, tick);
        return;
      }

      state.inFlight = true;
      state.lastAttemptAt = now;

      try {
        const guesses = await this.aiPlayerService.recognizeStrokes(
          round.strokes,
          round.targetWord,
          round.wordDifficulty,
        );

        // 识别期间本轮可能已结束，丢弃过期结果
        const current = this.gameEngine.getGame(roomId);
        const currentRound = current?.rounds[current.currentRound - 1];
        if (!current || !currentRound || currentRound !== round || currentRound.status !== 'active') return;

        // 精确匹配：完全一致才算猜对（不采用模糊匹配）
        const matched = guesses.find((g) => g.word.trim() === round.targetWord);

        const aiGuessEvent: AIGuessEvent = {
          playerId: AI_PLAYER_ID,
          guesses: guesses.slice(0, 3),
          isCorrect: matched !== undefined,
          matchedWord: matched?.word,
        };
        this.server.to(roomId).emit('ai_guess', aiGuessEvent);

        if (matched) {
          const { guess, guesserRank, allGuessed } = this.gameEngine.processAIGuess(
            current,
            currentRound,
            AI_PLAYER_ID,
            matched.word,
          );

          if (guesserRank) {
            const correctEvent: CorrectGuessEvent = {
              playerId: AI_PLAYER_ID,
              nickname: AI_PLAYER_NICKNAME,
              rank: guesserRank,
              score: guess.score,
              guessersRemaining:
                current.drawerOrder.filter((id) => id !== currentRound.drawerId).length -
                currentRound.guesses.filter((g) => g.isCorrect).length,
            };
            this.server.to(roomId).emit('correct_guess', correctEvent);
          }

          this.logger.log(`AI guessed correctly in room ${roomId}: ${matched.word}`);

          if (allGuessed) {
            this.gameEngine.endRound(current, currentRound, 'all_guessed');
            this.broadcastRoundEnd(roomId);
            return;
          }
        }
      } catch (error) {
        this.logger.warn(`AI guess attempt failed in room ${roomId}: ${(error as Error).message}`);
      } finally {
        state.inFlight = false;
      }

      // 本轮仍在进行 → 间隔 AI_GUESS_INTERVAL_MS 后继续尝试
      if (this.aiGuessLoops.get(roomId) === state) {
        this.scheduleAIGuessTick(state, tick);
      }
    };

    this.scheduleAIGuessTick(state, tick);
    this.logger.log(`AI guess loop started in room ${roomId}`);
  }

  private scheduleAIGuessTick(
    state: { timer: ReturnType<typeof setTimeout> | null },
    tick: () => Promise<void>,
  ): void {
    state.timer = setTimeout(() => {
      void tick();
    }, AI_GUESS_INTERVAL_MS);
  }

  private stopAIGuessLoop(roomId: string): void {
    const state = this.aiGuessLoops.get(roomId);
    if (state) {
      if (state.timer) clearTimeout(state.timer);
      this.aiGuessLoops.delete(roomId);
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

    // 轮次是否还有下一轮（以 totalRounds 为准，画者顺序循环复用）
    const hasNext = game.currentRound < game.totalRounds;
    const nextDrawerId = hasNext
      ? game.drawerOrder[(game.currentDrawerIndex + 1) % game.drawerOrder.length]
      : undefined;

    const event: RoundEndedEvent = {
      roundNumber: round.roundNumber,
      targetWord: round.targetWord,
      drawerId: round.drawerId,
      drawerNickname: drawer?.nickname || 'Unknown',
      drawerScore,
      scores,
      totalScores,
      endReason: round.endReason || (round.endedAt ? 'all_guessed' : 'timeout'),
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

    const roundsSummary = game.rounds.map((r) => ({
      roundNumber: r.roundNumber,
      targetWord: r.targetWord,
      drawer: room.players.get(r.drawerId)?.nickname || 'Unknown',
      correctGuessers: r.guesses
        .filter((g) => g.isCorrect)
        .map((g) => room.players.get(g.playerId)?.nickname || 'Unknown'),
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
      // 提示观众可以加入下一局（使用 server.to(socketId) 避免访问 sockets.sockets）
      const spectatorIds = [...room.spectators.keys()];
      for (const sid of spectatorIds) {
        const spectator = room.spectators.get(sid);
        if (spectator?.socketId) {
          this.server.to(spectator.socketId).emit('join_next_game_prompt', {
            message: '游戏已结束，是否加入下一局？',
          });
        }
      }
    }

    this.gameEngine.removeGame(roomId);
    this.stopAIGuessLoop(roomId);
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
        const remainingPlayers = [...room.players.keys()].filter((id) => id !== userId);
        if (remainingPlayers.length > 0) {
          const newDrawer = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)];
          this.gameEngine.switchDrawer(game, round, newDrawer, () => {
            this.broadcastRoundEnd(roomId);
          });
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
    // 优先使用 JWT 验证后设置的 userId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifiedUserId = (client as any).userId;
    if (verifiedUserId) return verifiedUserId;
    // 回退到 handshake.auth（游客模式）
    return (client.handshake.auth?.userId as string) || `guest_${client.id.substring(0, 8)}`;
  }

  private getNickname(client: Socket): string {
    // 优先使用 JWT 验证后设置的 username
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifiedUsername = (client as any).username;
    if (verifiedUsername) return verifiedUsername;
    // 回退到 handshake.auth（游客模式）
    return (client.handshake.auth?.nickname as string) || `Player_${client.id.substring(0, 4)}`;
  }

  private getPlayerNickname(roomId: string, userId: string): string {
    const room = this.roomManager.findById(roomId);
    if (!room) return 'Unknown';
    const player = room.players.get(userId) || room.spectators.get(userId);
    return player?.nickname || 'Unknown';
  }

  private mapPlayers(room: {
    players: Map<
      string,
      { userId: string; nickname: string; avatarUrl?: string; role: string; score: number; connectionStatus: string; isAI?: boolean }
    >;
  }): PlayerInfo[] {
    return [...room.players.values()].map((p) => ({
      userId: p.userId,
      nickname: p.nickname,
      avatarUrl: p.avatarUrl,
      role: p.role as PlayerInfo['role'],
      score: p.score,
      connectionStatus: p.connectionStatus as PlayerInfo['connectionStatus'],
      isAI: p.isAI,
    }));
  }

  private mapSinglePlayer(p: {
    userId: string;
    nickname: string;
    avatarUrl?: string;
    role: string;
    score: number;
    connectionStatus: string;
    isAI?: boolean;
  }): PlayerInfo {
    return {
      userId: p.userId,
      nickname: p.nickname,
      avatarUrl: p.avatarUrl,
      role: p.role as PlayerInfo['role'],
      score: p.score,
      connectionStatus: p.connectionStatus as PlayerInfo['connectionStatus'],
      isAI: p.isAI,
    };
  }
}
