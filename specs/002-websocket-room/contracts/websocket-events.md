# WebSocket Event Contracts

**Feature**: 002-websocket-room | **Date**: 2026-08-02

所有事件使用 Socket.IO，命名空间默认为 `/`。所有客户端事件需携带 JWT token 进行身份验证（在 `auth` 字段或 Socket.IO `auth` handshake 中）。

---

## 客户端 → 服务端

### `create_room`

创建新房间。

```typescript
// Payload
interface CreateRoomPayload {
  maxPlayers: number;          // 4-8
  difficulty: 'easy' | 'medium' | 'hard';
}

// Response (ack callback)
interface CreateRoomResponse {
  success: boolean;
  data?: {
    roomId: string;
    inviteCode: string;
    hostId: string;
    maxPlayers: number;
    difficulty: string;
    players: PlayerInfo[];
  };
  error?: string;
}
```

---

### `join_room`

通过邀请码加入房间。

```typescript
// Payload
interface JoinRoomPayload {
  inviteCode: string;          // 6位邀请码
}

// Response (ack callback)
interface JoinRoomResponse {
  success: boolean;
  data?: {
    roomId: string;
    inviteCode: string;
    hostId: string;
    maxPlayers: number;
    difficulty: string;
    players: PlayerInfo[];
    status: RoomStatus;
  };
  error?: string;
  // 可能的 error: "ROOM_NOT_FOUND" | "ROOM_FULL" | "ALREADY_IN_ROOM"
}
```

---

### `leave_room`

离开当前房间。

```typescript
// Payload (no extra fields needed, socket context provides player info)
interface LeaveRoomPayload {}

// Response (ack callback)
interface LeaveRoomResponse {
  success: boolean;
}
```

---

### `start_game`

房主开始游戏。

```typescript
// Payload
interface StartGamePayload {}

// Response (ack callback)
interface StartGameResponse {
  success: boolean;
  error?: string;
  // 可能的 error: "NOT_HOST" | "NOT_ENOUGH_PLAYERS" | "GAME_ALREADY_STARTED"
}
```

---

### `canvas_action`

绘画者发送画布操作。

```typescript
// Payload
interface CanvasActionPayload {
  type: 'draw' | 'erase' | 'undo' | 'clear';
  brush?: {
    color: string;             // hex, e.g. "#FF0000"
    size: number;              // px
    opacity: number;           // 0-1
  };
  points?: Array<{ x: number; y: number }>;
}

// No ack callback (fire-and-forget for low latency)
```

---

### `submit_guess`

玩家提交猜词。

```typescript
// Payload
interface SubmitGuessPayload {
  text: string;                // 猜测文本
}

// Response (ack callback)
interface SubmitGuessResponse {
  success: boolean;
  data?: {
    isCorrect: boolean;
    proximity: 'exact' | 'close' | 'length_match' | 'wrong';
    score: number;
    rank?: number;             // 猜对排名（1st/2nd/3rd）
  };
}
```

---

### `reconnect`

断线后重连恢复状态。

```typescript
// Payload
interface ReconnectPayload {
  roomId: string;
  sessionToken: string;        // 之前的 session token
}

// Response (ack callback)
interface ReconnectResponse {
  success: boolean;
  data?: {
    roomState: Room;           // 完整房间状态
    gameState?: GameSession;   // 当前游戏状态（如果有）
    currentRound?: Round;      // 当前轮次状态
    playerScore: number;       // 该玩家的当前分数
  };
  error?: string;
  // 可能的 error: "ROOM_NOT_FOUND" | "SESSION_EXPIRED"
}
```

---

### `join_as_spectator`

游戏开始后以观众身份加入。

```typescript
// Payload
interface JoinAsSpectatorPayload {
  inviteCode: string;
}

// Response (ack callback)
interface JoinAsSpectatorResponse {
  success: boolean;
  data?: {
    roomId: string;
    players: PlayerInfo[];
    currentRound: number;
    scores: Record<string, number>;
  };
  error?: string;
}
```

---

## 服务端 → 客户端（广播事件）

### `player_joined`

广播给房间所有成员（包括新加入者）。

```typescript
interface PlayerJoinedEvent {
  player: PlayerInfo;
  playerCount: number;         // 当前房间人数
  maxPlayers: number;
}
```

---

### `player_left`

广播给房间剩余成员。

```typescript
interface PlayerLeftEvent {
  playerId: string;
  nickname: string;
  playerCount: number;
  reason: 'voluntary' | 'timeout';
}
```

---

### `player_disconnected`

广播给房间所有成员。

```typescript
interface PlayerDisconnectedEvent {
  playerId: string;
  nickname: string;
  disconnectedAt: string;      // ISO timestamp
  reconnectDeadline: string;   // ISO timestamp (30s later)
}
```

---

### `player_reconnected`

广播给房间所有成员。

```typescript
interface PlayerReconnectedEvent {
  playerId: string;
  nickname: string;
}
```

---

### `host_changed`

广播给房间所有成员。

```typescript
interface HostChangedEvent {
  oldHostId: string;
  newHostId: string;
  newHostNickname: string;
}
```

---

### `game_started`

广播给房间所有成员。

```typescript
interface GameStartedEvent {
  totalRounds: number;
  drawerOrder: string[];       // userId 顺序（不暴露具体是谁，只暴露数量）
  firstDrawerIndex: number;    // 当前轮次绘画者在 order 中的索引
  countdown: number;           // 3 秒
}
```

---

### `round_started`

发给绘画者（含词汇）和其他玩家（不含词汇）。

```typescript
// 发给绘画者
interface RoundStartedForDrawerEvent {
  roundNumber: number;
  targetWord: string;          // 仅绘画者可见
  difficulty: string;
  timeLimit: number;           // 60 秒
}

// 发给其他玩家
interface RoundStartedForGuessersEvent {
  roundNumber: number;
  wordLength: number;          // 词汇字符数
  wordHint: string;            // 如 "___" (下划线占位)
  timeLimit: number;           // 60 秒
}
```

---

### `canvas_sync`

广播给所有非绘画者。

```typescript
interface CanvasSyncEvent {
  sequenceNumber: number;
  type: 'draw' | 'erase' | 'undo' | 'clear';
  brush?: {
    color: string;
    size: number;
    opacity: number;
  };
  points?: Array<{ x: number; y: number }>;
  timestamp: number;
}
```

---

### `guess_result`

发给猜词者本人。

```typescript
interface GuessResultEvent {
  isCorrect: boolean;
  proximity: 'exact' | 'close' | 'length_match' | 'wrong';
  score: number;
  rank?: number;               // 第几个猜对的（1st/2nd/3rd）
}
```

---

### `correct_guess`

广播给房间所有成员（有人猜对时）。

```typescript
interface CorrectGuessEvent {
  playerId: string;
  nickname: string;
  rank: number;                // 1st/2nd/3rd
  score: number;
  guessersRemaining: number;   // 还剩几人未猜对
}
```

---

### `round_ended`

广播给房间所有成员。

```typescript
interface RoundEndedEvent {
  roundNumber: number;
  targetWord: string;          // 揭晓答案
  drawerId: string;
  drawerNickname: string;
  drawerScore: number;
  scores: Record<string, number>; // playerId → 本轮得分
  totalScores: Record<string, number>; // playerId → 累计总分
  endReason: 'all_guessed' | 'timeout';
  nextDrawerId?: string;       // 下一轮绘画者
}
```

---

### `game_ended`

广播给房间所有成员。

```typescript
interface GameEndedEvent {
  finalScores: Array<{
    playerId: string;
    nickname: string;
    totalScore: number;
    rank: number;
    bestGuess?: string;         // 最佳猜词
  }>;
  roundsSummary: Array<{
    roundNumber: number;
    targetWord: string;
    drawer: string;
    correctGuessers: string[];
  }>;
}
```

---

### `error`

发给触发错误的客户端。

```typescript
interface ErrorEvent {
  code: string;
  message: string;
  // 常见 code:
  // "ROOM_NOT_FOUND" | "ROOM_FULL" | "NOT_HOST"
  // "NOT_ENOUGH_PLAYERS" | "GAME_ALREADY_STARTED"
  // "NOT_YOUR_TURN" | "INVALID_ACTION" | "SESSION_EXPIRED"
}
```

---

## 辅助类型

```typescript
type RoomStatus = 'waiting' | 'playing';
type Difficulty = 'easy' | 'medium' | 'hard';
type PlayerRole = 'drawer' | 'guesser' | 'spectator';

interface PlayerInfo {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  role: PlayerRole;
  score: number;
  connectionStatus: 'connected' | 'disconnected';
}
```
