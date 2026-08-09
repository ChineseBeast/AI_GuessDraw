import type { Difficulty, RoomStatus, GameStatus, PlayerRole, ConnectionStatus, GuessProximity, RoundEndReason, LeaveReason } from '@draw-guess/shared';

// ─── Client → Server Payloads ──────────────────────

export interface CreateRoomPayload {
  maxPlayers: number;
  difficulty: Difficulty;
  /** 是否允许 AI 作为玩家参与游戏（房主设置） */
  allowAI?: boolean;
}

export interface JoinRoomPayload {
  inviteCode: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StartGamePayload {
  // no extra fields
}

export interface CanvasActionPayload {
  type: 'draw' | 'erase' | 'undo' | 'clear';
  brush?: {
    color: string;
    size: number;
    opacity: number;
  };
  points?: { x: number; y: number }[];
}

export interface SubmitGuessPayload {
  text: string;
}

export interface ReconnectPayload {
  roomId: string;
  sessionToken: string;
}

// ─── Server → Client Payloads ──────────────────────

export interface RoomCreatedResponse {
  roomId: string;
  inviteCode: string;
  hostId: string;
  maxPlayers: number;
  difficulty: string;
  players: PlayerInfo[];
}

export interface RoomJoinedResponse {
  roomId: string;
  inviteCode: string;
  hostId: string;
  maxPlayers: number;
  difficulty: string;
  players: PlayerInfo[];
  status: RoomStatus;
}

export interface PlayerInfo {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  role: PlayerRole;
  score: number;
  connectionStatus: ConnectionStatus;
  /** 是否为 AI 玩家 */
  isAI?: boolean;
}

export interface PlayerJoinedEvent {
  player: PlayerInfo;
  playerCount: number;
  maxPlayers: number;
}

export interface PlayerLeftEvent {
  playerId: string;
  nickname: string;
  playerCount: number;
  reason: LeaveReason;
}

export interface PlayerDisconnectedEvent {
  playerId: string;
  nickname: string;
  disconnectedAt: string;
  reconnectDeadline: string;
}

export interface PlayerReconnectedEvent {
  playerId: string;
  nickname: string;
}

export interface HostChangedEvent {
  oldHostId: string;
  newHostId: string;
  newHostNickname: string;
}

export interface GameStartedEvent {
  totalRounds: number;
  drawerOrder: string[];
  firstDrawerIndex: number;
  countdown: number;
}

export interface RoundStartedForDrawer {
  roundNumber: number;
  drawerId: string;
  targetWord: string;
  difficulty: string;
  timeLimit: number;
}

export interface RoundStartedForGuessers {
  roundNumber: number;
  drawerId: string;
  wordLength: number;
  wordHint: string;
  timeLimit: number;
}

export interface CanvasSyncEvent {
  sequenceNumber: number;
  type: 'draw' | 'erase' | 'undo' | 'clear';
  brush?: {
    color: string;
    size: number;
    opacity: number;
  };
  points?: { x: number; y: number }[];
  timestamp: number;
}

export interface GuessResultEvent {
  isCorrect: boolean;
  proximity: GuessProximity;
  score: number;
  rank?: number;
}

export interface CorrectGuessEvent {
  playerId: string;
  nickname: string;
  rank: number;
  score: number;
  guessersRemaining: number;
}

export interface RoundEndedEvent {
  roundNumber: number;
  targetWord: string;
  drawerId: string;
  drawerNickname: string;
  drawerScore: number;
  scores: Record<string, number>;
  totalScores: Record<string, number>;
  endReason: RoundEndReason;
  nextDrawerId?: string;
}

export interface DrawerFinishedEvent {
  drawerId: string;
}

/** AI 玩家状态变化（绘画中/绘画完成/猜词中） */
export interface AIStatusEvent {
  playerId: string;
  status: 'drawing' | 'draw_done' | 'thinking';
}

/** AI 玩家的猜词结果（广播给所有玩家） */
export interface AIGuessEvent {
  playerId: string;
  guesses: { word: string; confidence: number }[];
  isCorrect: boolean;
  matchedWord?: string;
}

export interface GameEndedEvent {
  finalScores: {
    playerId: string;
    nickname: string;
    totalScore: number;
    rank: number;
    bestGuess?: string;
  }[];
  roundsSummary: {
    roundNumber: number;
    targetWord: string;
    drawer: string;
    correctGuessers: string[];
  }[];
}

export interface ErrorEvent {
  code: string;
  message: string;
}

// ─── Internal Types ────────────────────────────────

export interface RoomPlayer {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  role: PlayerRole;
  score: number;
  connectionStatus: ConnectionStatus;
  disconnectedAt?: Date;
  joinedAt: Date;
  socketId: string;
  sessionToken: string;
  /** 是否为 AI 玩家（无 socket，由服务端驱动行为） */
  isAI?: boolean;
}

export interface Room {
  id: string;
  inviteCode: string;
  hostId: string;
  status: RoomStatus;
  maxPlayers: number;
  difficulty: Difficulty;
  /** 是否允许 AI 玩家参与（创建房间时由房主决定） */
  allowAI: boolean;
  createdAt: Date;
  players: Map<string, RoomPlayer>;
  spectators: Map<string, RoomPlayer>;
}

export interface GameState {
  roomId: string;
  currentRound: number;
  totalRounds: number;
  drawerOrder: string[];
  currentDrawerIndex: number;
  status: GameStatus;
  startedAt: Date;
  rounds: RoundState[];
  wordPool: WordEntry[];
}

export interface RoundState {
  roundNumber: number;
  drawerId: string;
  targetWord: string;
  wordDifficulty: Difficulty;
  startedAt: Date;
  endedAt?: Date;
  endReason?: RoundEndReason;
  guesses: GuessRecord[];
  strokes: CanvasSyncEvent[];
  status: 'active' | 'completed';
  /** 本轮时长（ms，AI 绘画轮次会延长） */
  durationMs: number;
  timerHandle?: ReturnType<typeof setTimeout>;
}

export interface GuessRecord {
  playerId: string;
  text: string;
  isCorrect: boolean;
  proximity: GuessProximity;
  score: number;
  submittedAt: Date;
}

export interface WordEntry {
  word: string;
  difficulty: Difficulty;
  category?: string;
}
