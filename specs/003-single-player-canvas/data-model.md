# Data Model: 单机模式画布与 AI 对战

**Feature**: 003-single-player-canvas | **Date**: 2026-08-02

---

## Entity Relationship

```
SinglePlayerGame (1) ──── (5) SinglePlayerRound
                                   │
                          ┌────────┴────────┐
                          │                 │
                    用户画 AI 猜       AI 画 用户猜
                          │                 │
                    AIGuess[]         userGuesses[]
```

---

## Core Entities

### SinglePlayerGame

| Field | Type | Description |
|-------|------|-------------|
| id | string | 游戏会话唯一标识 (nanoid) |
| status | GamePhase | idle → drawing → ai_recognizing → guessing → round_end → game_end |
| currentRound | number | 当前轮次 (1-5) |
| totalRounds | number | 总轮次 (固定 5) |
| difficulty | Difficulty | easy / medium / hard |
| rounds | SinglePlayerRound[] | 所有轮次数据 |
| userScore | number | 用户累计得分 |
| aiScore | number | AI 累计得分 |
| startedAt | string (ISO 8601) | 游戏开始时间 |

### GamePhase (enum)

```typescript
type GamePhase =
  | 'idle'             // 初始状态，选择难度
  | 'drawing'          // 用户绘画回合
  | 'ai_recognizing'   // AI 识别中（用户提交后）
  | 'guessing'         // AI 回合，用户猜词
  | 'round_end'        // 单轮结束，展示结果
  | 'game_end';        // 5 轮结束，结算
```

### SinglePlayerRound

| Field | Type | Description |
|-------|------|-------------|
| roundNumber | number | 轮次编号 (1-5) |
| role | RoundRole | 'user_draws' \| 'ai_draws' |
| targetWord | string | 目标词 |
| wordDifficulty | Difficulty | 该词难度 |
| timeLimit | number | 该轮时间限制 (60s) |
| timeRemaining | number | 提交时剩余秒数 |
| userDrawing | string? | 画布 Base64 (仅 user_draws) |
| aiGuesses | AIGuess[]? | AI 猜测结果 (仅 user_draws) |
| userRoundScore | number | 用户本轮得分 |
| userGuesses | string[]? | 用户猜测历史 (仅 ai_draws) |
| userGuessedCorrectly | boolean? | 用户是否猜对 (仅 ai_draws) |
| aiRoundScore | number | AI 本轮得分 |

### RoundRole (enum)

```typescript
type RoundRole = 'user_draws' | 'ai_draws';
```

**轮换规则**: 第 1/3/5 轮用户画，第 2/4 轮 AI 画

### AIGuess

| Field | Type | Description |
|-------|------|-------------|
| word | string | 猜测词 |
| confidence | number | 置信度 (0-1) |

### AIRecognizeRequest

| Field | Type | Description |
|-------|------|-------------|
| image | string | Base64 编码的 PNG 图片 (含 data:image/png;base64, 前缀) |
| targetWord | string | 目标词（后端用于判定正确性） |
| difficulty | Difficulty | 难度（影响 mock 准确率） |

### AIRecognizeResponse

| Field | Type | Description |
|-------|------|-------------|
| guesses | AIGuess[] | Top-3 猜测 |
| isCorrect | boolean | 是否猜对 |
| matchedGuess | AIGuess? | 匹配的猜测（若猜对） |
| processingTime | number | 处理耗时 (ms) |

---

## Canvas State (Reused from shared)

```typescript
// From packages/shared/src/types/canvas.ts
interface CanvasState {
  strokes: CanvasStroke[];      // 已绘制的笔画
  undoneStrokes: CanvasStroke[]; // 被撤销的笔画（用于重做）
  backgroundColor: string;
  width: number;                // 800
  height: number;               // 600
}

interface CanvasStroke {
  id: string;
  points: Point[];
  brush: BrushConfig;
  tool: 'pen' | 'eraser';
  timestamp: number;
}

interface BrushConfig {
  color: string;
  width: number;     // 2 | 4 | 8
  opacity: number;   // 1
}
```

---

## Tool State

```typescript
interface ToolState {
  activeTool: 'pen' | 'eraser';
  activeColor: string;         // hex color
  activeBrushWidth: number;    // 2 | 4 | 8
}

const DEFAULT_TOOL_STATE: ToolState = {
  activeTool: 'pen',
  activeColor: '#000000',
  activeBrushWidth: 4,
};
```

---

## Score Breakdown

```typescript
interface ScoreBreakdown {
  baseScore: number;          // 10 (猜对) | 1 (参与分) | 0 (未猜对)
  timeBonus: number;          // floor(remaining × 0.1), max 5
  confidenceBonus: number;    // floor(confidence × 5), max 5 (仅 user_draws 猜对时)
  total: number;
}
```

**计分示例**:
- 用户画「苹果」→ AI 猜对(confidence 0.92)，剩余 35s → 10 + 3 + 4 = 17 分
- 用户画「苹果」→ AI 猜错 → 1 分
- AI 画「香蕉」→ 用户猜对，剩余 42s → 10 + 4 = 14 分
- AI 画「香蕉」→ 用户猜错 → 0 分

---

## State Machine Transitions

```
┌──────┐  START_GAME   ┌──────────┐  SUBMIT_DRAWING  ┌────────────────┐
│ idle │ ─────────────→ │ drawing  │ ────────────────→ │ ai_recognizing │
└──────┘                └──────────┘                   └───────┬────────┘
                             ↑                                 │
                             │                           AI_RECOGNIZED
                             │                                 │
                             │              ┌──────────┐       │
                             │              │ guessing │ ←─────┘ (if role=ai_draws)
                             │              └────┬─────┘
                             │                   │
                             │         SUBMIT_GUESS / TIMEOUT
                             │                   │
                             │         ┌──────────┐
                             └─────────│round_end │ (if currentRound < 5)
                             NEXT_ROUND └────┬─────┘
                                             │
                                       END_GAME (if currentRound = 5)
                                             │
                                        ┌──────────┐
                                        │ game_end │
                                        └──────────┘
```
