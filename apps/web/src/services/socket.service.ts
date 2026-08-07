import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  SubmitGuessPayload,
  ReconnectPayload,
  CanvasActionPayload,
} from '@draw-guess/shared';

type EventHandler<T = unknown> = (data: T) => void;

export class SocketService {
  private socket: Socket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private userId: string;
  private nickname: string;

  constructor(serverUrl: string, userId: string, nickname: string) {
    this.userId = userId;
    this.nickname = nickname;
    this.connect(serverUrl);
  }

  private connect(serverUrl: string): void {
    this.socket = io(serverUrl, {
      auth: { userId: this.userId, nickname: this.nickname },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      const eventHandlers = this.handlers.get('connect');
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          handler(undefined);
        }
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      const eventHandlers = this.handlers.get('disconnect');
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          handler(reason);
        }
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      const eventHandlers = this.handlers.get('connect_error');
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          handler(error);
        }
      }
    });

    // Register all server events
    const events = [
      'room_created', 'room_joined', 'player_joined', 'player_left',
      'player_disconnected', 'player_reconnected', 'host_changed',
      'game_started', 'round_started', 'canvas_sync', 'guess_result',
      'correct_guess', 'round_ended', 'game_ended', 'error',
    ];

    for (const event of events) {
      this.socket.on(event, (data: unknown) => {
        const eventHandlers = this.handlers.get(event);
        if (eventHandlers) {
          for (const handler of eventHandlers) {
            handler(data);
          }
        }
      });
    }
  }

  // ─── Event Subscription ──────────────────────────

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(event)?.delete(handler as EventHandler);
    };
  }

  // ─── Emitters ────────────────────────────────────

  createRoom(payload: CreateRoomPayload): void {
    this.socket?.emit('create_room', payload);
  }

  joinRoom(payload: JoinRoomPayload): void {
    this.socket?.emit('join_room', payload);
  }

  leaveRoom(): void {
    this.socket?.emit('leave_room');
  }

  startGame(): void {
    this.socket?.emit('start_game', {});
  }

  canvasAction(payload: CanvasActionPayload): void {
    this.socket?.emit('canvas_action', payload);
  }

  submitGuess(payload: SubmitGuessPayload): void {
    this.socket?.emit('submit_guess', payload);
  }

  reconnect(payload: ReconnectPayload): void {
    this.socket?.emit('reconnect', payload);
  }

  // ─── Lifecycle ───────────────────────────────────

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.handlers.clear();
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  get socketId(): string | undefined {
    return this.socket?.id;
  }
}

// Singleton factory
let socketInstance: SocketService | null = null;

export function createSocketService(serverUrl: string, userId: string, nickname: string): SocketService {
  // 如果已有连接的 socket，复用而不新建（避免页面切换时丢失事件）
  if (socketInstance?.connected) {
    return socketInstance;
  }
  if (socketInstance) {
    socketInstance.disconnect();
  }
  socketInstance = new SocketService(serverUrl, userId, nickname);
  return socketInstance;
}

export function getSocketService(): SocketService | null {
  return socketInstance;
}
