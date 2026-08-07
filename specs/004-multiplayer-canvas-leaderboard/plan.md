# Implementation Plan: 联机画布集成 + 排行榜

**Branch**: `004-multiplayer-canvas-leaderboard` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

---

## Summary

将 Feature 003 的共享 Canvas 组件集成到 Feature 002 的联机模式前端，完成实时画布同步 UI；同时构建排行榜系统（后端 REST API + 前端页面）。这是联机模式从前端占位到完整体验的关键 Feature。

---

## Technical Context

**Language/Version**: TypeScript 5.6+, React 18+, NestJS 10+

**Primary Dependencies**: `@draw-guess/ui` (Canvas), Socket.IO client, React state management

**Storage**: 内存 Map（排行榜 V1，同房间系统策略），接口抽象可迁移至 MySQL/Redis

**Testing**: Vitest + React Testing Library

**Performance Goals**: 画布同步 < 100ms, 排行榜查询 < 200ms

---

## Constitution Check

| 原则 | 状态 | 说明 |
|------|------|------|
| I. Spec-First | ✅ | spec.md → plan.md → tasks.md → implement |
| II. 用户价值优先 | ✅ | 4 个用户故事，P0 覆盖核心联机体验 |
| III. 跨平台一致性 | ✅ | 共享 Canvas 组件复用，WebSocket 事件契约一致 |
| IV. AI 服务质量 | ⚠️ N/A | 本 feature 不涉及 AI 服务 |
| V. 实时通信可靠性 | ✅ | 基于 Feature 002 已验证的 Socket.IO 基础设施 |

---

## Project Structure

### Source Code Changes

```text
apps/web/src/
├── pages/
│   └── multiplayer/
│       ├── lobby.tsx           # 🔄 重写：集成 page flow
│       ├── game.tsx            # 🔄 重写：集成 Canvas 组件 + canvas_sync
│       └── components/
│           ├── CanvasView.tsx  # 🆕 联机画布（Canvas + canvas_sync 接收器）
│           ├── GuessPanel.tsx  # 🆕 猜词面板（输入 + 反馈 + 已猜列表）
│           └── PlayerList.tsx  # 🆕 玩家列表（含得分、连接状态）
├── pages/
│   └── leaderboard/
│       └── index.tsx           # 🆕 排行榜页面
├── hooks/
│   ├── useMultiplayerCanvas.ts # 🆕 联机画布 hook（canvas_sync 事件处理）
│   └── useLeaderboard.ts       # 🆕 排行榜数据 hook
├── services/
│   └── leaderboard.service.ts  # 🆕 排行榜 API 客户端
└── main.tsx                    # 🔄 扩展：添加 leaderboard 页面路由

apps/server/src/
├── modules/
│   └── leaderboard/
│       ├── leaderboard.controller.ts  # 🆕 REST API
│       ├── leaderboard.service.ts     # 🆕 排行榜业务逻辑
│       └── leaderboard.module.ts      # 🆕
└── app.module.ts                      # 🔄 注册 LeaderboardModule

packages/shared/src/
├── types/
│   └── leaderboard.ts          # 🆕 排行榜类型
└── constants/
    └── leaderboard.ts          # 🆕 排行榜常量
```

---

## Data Model

### Leaderboard

```typescript
// 排行榜条目
interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  avatarUrl?: string;
  totalScore: number;
  gamesPlayed: number;
  winCount: number;
  lastPlayedAt: string;
  rank: number;
}

// 排行榜查询参数
interface LeaderboardQuery {
  period: 'weekly' | 'monthly' | 'all';
  limit?: number;   // default 50
  offset?: number;  // default 0
}

// 游戏结果提交
interface GameResultSubmit {
  playerId: string;
  nickname: string;
  score: number;
  mode: 'single' | 'multiplayer';
  won: boolean;
  rounds: number;
}
```

### Multiplayer Canvas State

```typescript
// 联机画布状态（前端）
interface MultiplayerCanvasState {
  strokes: CanvasStroke[];      // 已同步的笔画
  isDrawer: boolean;            // 当前用户是否是绘画者
  connected: boolean;           // WebSocket 连接状态
  lastSequenceNumber: number;   // 最后收到的序列号
}
```

---

## API Contracts

### GET /api/leaderboard

```http
GET /api/leaderboard?period=weekly&limit=50&offset=0
```

Response:
```json
{
  "entries": [
    {
      "playerId": "user_abc123",
      "nickname": "画画高手",
      "totalScore": 1250,
      "gamesPlayed": 42,
      "winCount": 28,
      "lastPlayedAt": "2026-08-02T10:30:00Z",
      "rank": 1
    }
  ],
  "total": 156
}
```

### POST /api/leaderboard/submit

```json
{
  "playerId": "user_abc123",
  "nickname": "画画高手",
  "score": 85,
  "mode": "single",
  "won": true,
  "rounds": 5
}
```

Response: `201 Created`

---

## Component Integration

### Canvas Sync Flow

```
Drawer: pointer events → Canvas component → onStrokeComplete
  → socket.emit('canvas_action', { type, brush, points })
  → Server broadcasts 'canvas_sync'
  → Guesser/Spectator: handleCanvasSync → drawStroke on local canvas
```

### Page Flow

```
Home → [单机] → SinglePlayerPage
     → [联机] → MultiplayerLobby → MultiplayerGame → (result in-game)
     → [排行榜] → LeaderboardPage
```

---

## Key Technical Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| Canvas 组件复用 | 直接使用 `@draw-guess/ui` Canvas | Feature 003 已验证，避免重复开发 |
| canvas_sync 接收 | useMultiplayerCanvas hook | 封装 WebSocket 事件 → Canvas stroke 映射 |
| 排行榜存储 | 内存 Map + 接口抽象 | V1 快速上线，接口设计兼容后续 MySQL 迁移 |
| 排行榜周期 | 基于游戏时间戳计算 | weekly = 本周一 00:00 至今，monthly = 本月 1 日至今 |
| 页面路由 | 状态驱动（useState） | 与现有架构一致，无需引入 React Router 依赖 |
| 游戏结果提交 | 单机/联机结束后自动提交 | 无感提交，提升数据覆盖率 |
