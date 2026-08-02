/** 游戏模式 */
export type GameMode = 'single' | 'multiplayer' | 'story';

/** 难度级别 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** 房间状态 */
export type RoomStatus = 'waiting' | 'playing';

/** 游戏状态 */
export type GameStatus = 'waiting' | 'countdown' | 'playing' | 'round_end' | 'game_end';

/** 玩家角色 */
export type PlayerRole = 'drawer' | 'guesser' | 'spectator';

/** 连接状态 */
export type ConnectionStatus = 'connected' | 'disconnected';

/** 猜词接近度 */
export type GuessProximity = 'exact' | 'close' | 'length_match' | 'wrong';

/** 画布操作类型 */
export type CanvasActionType = 'draw' | 'erase' | 'undo' | 'clear';

/** 回合结束原因 */
export type RoundEndReason = 'all_guessed' | 'timeout';

/** 离开原因 */
export type LeaveReason = 'voluntary' | 'timeout';

// ─── 玩家 ────────────────────────────────────────

/** 玩家信息 */
export interface PlayerInfo {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  isHost: boolean;
  isDrawing: boolean;
  isConnected: boolean;
}

/** 房间内玩家（完整信息） */
export interface RoomPlayer {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  role: PlayerRole;
  score: number;
  connectionStatus: ConnectionStatus;
  disconnectedAt?: string;
  joinedAt: string;
  socketId: string;
}

// ─── 房间 ────────────────────────────────────────

/** 游戏房间 */
export interface GameRoom {
  id: string;
  inviteCode: string;
  mode: GameMode;
  status: RoomStatus;
  players: PlayerInfo[];
  maxPlayers: number;
  currentRound: number;
  maxRounds: number;
  difficulty: Difficulty;
  createdAt: string;
}

/** 房间（完整信息） */
export interface Room {
  id: string;
  inviteCode: string;
  hostId: string;
  status: RoomStatus;
  maxPlayers: number;
  difficulty: Difficulty;
  createdAt: string;
  players: RoomPlayer[];
  spectators: RoomPlayer[];
}

// ─── 游戏会话 ────────────────────────────────────

/** 游戏会话 */
export interface GameSession {
  roomId: string;
  currentRound: number;
  totalRounds: number;
  drawerOrder: string[];
  currentDrawerIndex: number;
  status: GameStatus;
  startedAt: string;
}

/** 轮次信息 */
export interface Round {
  roundNumber: number;
  drawerId: string;
  targetWord: string;
  wordDifficulty: Difficulty;
  startedAt: string;
  endedAt?: string;
  guesses: Guess[];
  status: 'active' | 'completed';
}

// ─── 猜词 ────────────────────────────────────────

/** 猜词记录 */
export interface Guess {
  playerId: string;
  text: string;
  isCorrect: boolean;
  proximity: GuessProximity;
  score: number;
  submittedAt: string;
}

/** 猜测结果 */
export interface GuessResult {
  playerId: string;
  playerName: string;
  guess: string;
  isCorrect: boolean;
  proximity?: 'close' | 'far' | 'none';
  scoreAwarded: number;
}

// ─── 轮次/结算 ───────────────────────────────────

/** 轮次信息（旧版） */
export interface RoundInfo {
  roundNumber: number;
  totalRounds: number;
  drawerId: string;
  targetWord: string;
  timeRemaining: number;
}

/** 回合结果 */
export interface RoundResult {
  roundNumber: number;
  targetWord: string;
  guesses: GuessResult[];
  drawerScore: number;
  imageUrl?: string;
}

/** 游戏结算 */
export interface GameResult {
  roomId: string;
  mode: GameMode;
  rounds: RoundResult[];
  finalScores: Record<string, number>;
  winner: PlayerInfo;
  playedAt: string;
}

// ─── 画布 ────────────────────────────────────────
// 画笔和坐标点类型从 canvas.ts 导入，此处不再重复定义

// ─── WebSocket 事件 ──────────────────────────────

/** 客户端事件 */
export type ClientWSEvent =
  | 'create_room'
  | 'join_room'
  | 'leave_room'
  | 'start_game'
  | 'canvas_action'
  | 'submit_guess'
  | 'reconnect'
  | 'join_as_spectator';

/** 服务端事件 */
export type ServerWSEvent =
  | 'room_created'
  | 'room_joined'
  | 'player_joined'
  | 'player_left'
  | 'player_disconnected'
  | 'player_reconnected'
  | 'host_changed'
  | 'game_started'
  | 'round_started'
  | 'canvas_sync'
  | 'guess_result'
  | 'correct_guess'
  | 'round_ended'
  | 'game_ended'
  | 'error';

/** WebSocket 错误码 */
export type WSErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ALREADY_IN_ROOM'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'GAME_ALREADY_STARTED'
  | 'NOT_YOUR_TURN'
  | 'INVALID_ACTION'
  | 'SESSION_EXPIRED'
  | 'INTERNAL_ERROR';

