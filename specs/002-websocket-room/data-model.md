# Data Model: WebSocket 房间管理系统

**Feature**: 002-websocket-room | **Date**: 2026-08-02

## 核心实体

### Room（房间）

```typescript
interface Room {
  id: string;                    // UUID v4
  inviteCode: string;            // 6位字母数字（nanoid）
  hostId: string;                // 房主用户 ID
  status: RoomStatus;            // waiting | playing
  maxPlayers: number;            // 4-8
  difficulty: Difficulty;        // easy | medium | hard
  createdAt: Date;
  players: Map<string, Player>;  // playerId → Player
  spectators: Map<string, Player>; // spectatorId → Player
}
```

**状态转换**:
```
waiting ──[start_game]──→ playing
playing ──[game_end]────→ waiting (可重新开始)
```

**约束**:
- `inviteCode` 全局唯一
- `maxPlayers` 范围 4-8
- `players.size <= maxPlayers`
- 房间空置 5 分钟后自动销毁

---

### Player（房间内玩家）

```typescript
interface Player {
  userId: string;                // 用户 ID（来自 JWT）
  nickname: string;              // 昵称
  avatarUrl?: string;            // 头像 URL
  role: PlayerRole;              // drawer | guesser | spectator
  score: number;                 // 当前对局总分
  connectionStatus: 'connected' | 'disconnected';
  disconnectedAt?: Date;         // 断线时间
  joinedAt: Date;
  socketId: string;              // Socket.IO socket.id
}
```

**状态转换**:
```
connected ──[disconnect]──→ disconnected (开始30s倒计时)
disconnected ──[reconnect]──→ connected (清除倒计时)
disconnected ──[timeout 30s]──→ removed (从房间移除)
```

---

### GameSession（游戏会话）

```typescript
interface GameSession {
  roomId: string;                // 关联房间
  currentRound: number;          // 当前轮次（从 1 开始）
  totalRounds: number;           // 总轮数 = playerCount * 2
  drawerOrder: string[];         // 绘画者顺序（userId 数组）
  currentDrawerIndex: number;    // 当前绘画者在 drawerOrder 中的索引
  wordPool: WordEntry[];         // 本轮词汇池
  rounds: Round[];               // 历史轮次
  status: GameStatus;            // waiting | countdown | playing | round_end | game_end
  startedAt: Date;
}
```

**状态机**:
```
waiting ──→ countdown (3s) ──→ playing (60s) ──→ round_end (3s) ──→ countdown ──→ ...
                                                                     └──→ game_end
```

---

### Round（轮次）

```typescript
interface Round {
  roundNumber: number;           // 轮次序号
  drawerId: string;              // 绘画者 userId
  targetWord: string;            // 目标词汇
  wordDifficulty: Difficulty;    // 词汇难度
  startedAt: Date;
  endedAt?: Date;
  guesses: Guess[];              // 猜词记录
  strokes: CanvasStroke[];       // 画布操作记录（用于回放）
  status: 'active' | 'completed';
}
```

---

### Guess（猜词记录）

```typescript
interface Guess {
  playerId: string;              // 猜词者 userId
  text: string;                  // 猜测文本
  isCorrect: boolean;            // 是否正确
  proximity?: 'exact' | 'close' | 'length_match' | 'wrong';
  score: number;                 // 得分（0 表示未猜对）
  submittedAt: Date;
}
```

---

### CanvasStroke（画布操作）

```typescript
// 复用 packages/shared/src/types/canvas.ts 中已定义的类型
interface CanvasStroke {
  sequenceNumber: number;        // 全局递增序列号
  type: 'draw' | 'erase' | 'undo' | 'clear';
  brush?: BrushConfig;           // 画笔配置（draw 操作时）
  points?: Point[];              // 坐标点数组（draw 操作时）
  timestamp: number;             // 操作时间戳
}

interface BrushConfig {
  color: string;                 // 颜色（hex）
  size: number;                  // 粗细（px）
  opacity: number;               // 不透明度（0-1）
}

interface Point {
  x: number;
  y: number;
}
```

---

### WordEntry（词汇条目）

```typescript
interface WordEntry {
  word: string;                  // 词汇文本
  difficulty: Difficulty;        // 难度
  category?: string;             // 分类（可选）
  hints?: string[];              // 提示词（可选）
}
```

**词库结构** (静态 JSON):
```typescript
// apps/server/src/data/words.json
{
  "easy": ["苹果", "太阳", "房子", "猫咪", "星星", "花朵", "大树", "月亮", "汽车", "手机"],
  "medium": ["自行车", "金字塔", "彩虹", "恐龙", "火箭", "海盗船", "雪人", "冰淇淋", "蘑菇", "风筝"],
  "hard": ["蒙娜丽莎", "自由女神像", "黑洞", "丝绸之路", "兵马俑", "长城", "金字塔", "埃菲尔铁塔", "太极", "龙卷风"]
}
```

---

### WebSocket 事件枚举

```typescript
// 客户端 → 服务端
type ClientEvent =
  | 'create_room'       // 创建房间
  | 'join_room'         // 加入房间
  | 'leave_room'        // 离开房间
  | 'start_game'        // 开始游戏
  | 'canvas_action'     // 画布操作
  | 'submit_guess'      // 提交猜词
  | 'reconnect'         // 重连
  | 'join_as_spectator' // 观众加入游戏;

// 服务端 → 客户端
type ServerEvent =
  | 'room_created'       // 房间创建成功
  | 'room_joined'        // 加入房间成功
  | 'player_joined'      // 新玩家加入广播
  | 'player_left'        // 玩家离开广播
  | 'player_disconnected'// 玩家断线广播
  | 'player_reconnected' // 玩家重连广播
  | 'host_changed'       // 房主变更广播
  | 'game_started'       // 游戏开始
  | 'round_started'      // 轮次开始（含词汇信息给绘画者）
  | 'canvas_sync'        // 画布同步（给非绘画者）
  | 'guess_result'       // 猜词结果（给猜词者）
  | 'correct_guess'      // 正确猜词广播（给所有人）
  | 'round_ended'        // 轮次结束
  | 'game_ended'         // 游戏结束
  | 'error'              // 错误信息;
```

---

## 关系图

```
Room (1) ──has──→ (N) Player
Room (1) ──has──→ (1) GameSession
GameSession (1) ──contains──→ (N) Round
Round (1) ──contains──→ (N) Guess
Round (1) ──contains──→ (N) CanvasStroke
```

---

## 数据流

```
[Client A: drawer]
  │ canvas_action (draw stroke)
  ▼
[Server: RoomManager]
  │ validate, assign seqNo, store in round.strokes
  ▼
[Server: broadcast to room except drawer]
  │ canvas_sync (stroke data + seqNo)
  ▼
[Client B, C, D: guessers]
  │ render stroke on canvas
```
