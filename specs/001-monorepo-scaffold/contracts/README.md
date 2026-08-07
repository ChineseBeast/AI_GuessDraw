# Contracts: Monorepo 脚手架搭建

**Feature**: 001-monorepo-scaffold
**Date**: 2026-08-02

> 本 feature 为项目基础设施，不涉及 API 接口。以下为各子包的入口契约（package.json exports 约定）。

## 1. @draw-guess/shared 导出契约

```typescript
// packages/shared/src/index.ts

// 类型导出
export type { GameMode, GameRoom, PlayerInfo, GuessResult } from './types/game';
export type { User, AuthToken, LoginRequest } from './types/user';
export type { Story, StoryChapter, DrawingPrompt } from './types/story';
export type { CanvasStroke, BrushConfig, CanvasState } from './types/canvas';

// 常量导出
export { GAME_MODES, MAX_PLAYERS, ROUND_TIMES, DIFFICULTY_LEVELS } from './constants/game';
export { API_ROUTES, WS_EVENTS } from './constants/api';

// 工具函数导出
export { formatScore, calculateTimeBonus } from './utils/scoring';
export { generateInviteCode, validateRoomId } from './utils/room';
```

## 2. @draw-guess/web 入口契约

- 开发服务器: `http://localhost:5173`
- 构建产物: `apps/web/dist/`
- 路由约定:
  - `/` - 首页/模式选择
  - `/single` - 单机模式
  - `/room/:id` - 联机房间
  - `/story` - 故事模式
  - `/leaderboard` - 排行榜
  - `/profile` - 个人中心

## 3. @draw-guess/miniprogram 入口契约

- 编译目标: 微信小程序
- 输出目录: `apps/miniprogram/dist/`
- 页面约定:
  - `pages/index/index` - 首页
  - `pages/single/index` - 单机模式
  - `pages/room/index` - 联机房间
  - `pages/story/index` - 故事模式
  - `pages/leaderboard/index` - 排行榜

## 4. @draw-guess/server 入口契约

- 开发服务器: `http://localhost:3000`
- API 前缀: `/api/v1`
- 模块约定:
  - `UserModule` - 用户认证
  - `GameModule` - 游戏逻辑
  - `RoomModule` - 房间管理
  - `StoryModule` - 故事模式
  - `LeaderboardModule` - 排行榜

## 5. draw-guess-ai-service 入口契约

- 开发服务器: `http://localhost:8000`
- API 前缀: `/api/v1`
- 模块约定:
  - `recognition` - AI 图像识别
  - `drawing` - AI 绘画生成
  - `story` - 故事生成

## 6. 统一脚本契约

根 `package.json` scripts：

| 脚本 | 行为 |
|------|------|
| `pnpm dev` | 启动所有开发服务器（web + server + ai） |
| `pnpm build` | 构建所有子包 |
| `pnpm lint` | ESLint 检查所有子包 |
| `pnpm lint:fix` | ESLint 自动修复 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm clean` | 清理所有构建产物和缓存 |
