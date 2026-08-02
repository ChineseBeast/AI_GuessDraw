# Implementation Plan: WebSocket 房间管理系统

**Branch**: `002-websocket-room` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-websocket-room/spec.md`

## Summary

为"你画我猜AI"的联机模式构建 WebSocket 实时通信基础设施。核心交付：房间创建/加入（6位邀请码）、实时画布同步（<100ms）、游戏回合管理（状态机驱动猜词计分）、断线重连（30秒窗口）、观战模式。技术选型：Socket.IO + NestJS WebSocket Gateway + 内存状态管理。

## Technical Context

**Language/Version**: TypeScript 5.6+ (server + shared), React 18+ (web client)

**Primary Dependencies**: Socket.IO, @nestjs/websockets, @nestjs/platform-socket.io, socket.io-client, nanoid

**Storage**: 内存 Map（V1），接口抽象可迁移至 Redis（V2）

**Testing**: Jest (server unit + e2e), Vitest (web components)

**Target Platform**: Linux server (NestJS) + Web browser (React) + WeChat Mini Program (Taro)

**Project Type**: WebSocket real-time service (server + client SDK + web UI)

**Performance Goals**: 画布同步 < 100ms P95, 猜词判定 < 200ms, 500+ 并发房间

**Constraints**: 单实例部署（V1），WebSocket 连接数上限由 Socket.IO 管理

**Scale/Scope**: 500 房间 × 8 人 = 4000 并发连接，内存占用预计 < 500MB

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| 原则 | 状态 | 说明 |
|------|------|------|
| I. Spec-First | ✅ | spec.md / plan.md / tasks.md 完整 |
| II. 用户价值优先 | ✅ | 5 个用户故事按 P1-P3 优先级，MVP 覆盖 P1 |
| III. 跨平台一致性 | ✅ | WebSocket 事件契约统一，shared 包复用类型 |
| IV. AI 服务质量 | ⚠️ N/A | 本 feature 不涉及 AI 服务 |
| V. 实时通信可靠性 | ✅ | Socket.IO 保证可靠传输，<100ms 目标，30s 重连 |

## Project Structure

### Documentation (this feature)

```text
specs/002-websocket-room/
├── plan.md              # This file
├── research.md          # 10 项技术决策
├── data-model.md        # 核心实体与关系
├── contracts/           # WebSocket 事件契约
│   └── websocket-events.md
├── quickstart.md        # 本地启动指南
└── tasks.md             # 待生成（speckit-tasks）
```

### Source Code (repository root)

```text
apps/server/src/
├── gateway/                    # WebSocket Gateway (NEW)
│   ├── room.gateway.ts         # Socket.IO 房间事件处理
│   └── room.gateway.spec.ts
├── services/                   # 业务逻辑 (NEW)
│   ├── room-manager.service.ts # 房间 CRUD + 状态管理
│   ├── game-engine.service.ts  # 游戏状态机 + 计分
│   ├── word.service.ts         # 词汇库管理
│   └── *.spec.ts
├── data/
│   └── words.json              # 静态词汇库 (NEW)
├── types/
│   └── websocket.types.ts      # WebSocket 事件类型 (NEW)
└── app.module.ts               # 注册 Gateway + Services (MODIFY)

packages/shared/src/
├── types/
│   ├── canvas.ts               # CanvasStroke 已存在，按需扩展
│   └── game.ts                 # 添加联机模式相关类型 (MODIFY)
├── constants/
│   └── game.ts                 # 添加联机常量 (MODIFY)

apps/web/src/
├── services/
│   └── socket.service.ts       # Socket.IO 客户端封装 (NEW)
├── hooks/
│   ├── useRoom.ts              # 房间状态 Hook (NEW)
│   ├── useCanvas.ts            # 画布同步 Hook (NEW)
│   └── useGame.ts              # 游戏状态 Hook (NEW)
├── pages/
│   └── multiplayer/            # 联机模式页面 (NEW)
│       ├── lobby.tsx           # 房间大厅
│       ├── room.tsx            # 等待房间
│       ├── game.tsx            # 游戏中
│       └── result.tsx          # 结算页
└── components/
    └── canvas/                 # 画布组件（后续 feature 详细开发）

apps/miniprogram/src/           # 小程序端对应结构 (后续 feature)
```

**Structure Decision**: 遵循 Monorepo 架构——服务端逻辑在 `apps/server`，Web 客户端在 `apps/web`，共享类型在 `packages/shared`。Socket.IO Gateway 作为 NestJS Module 集成，RoomManager 和 GameEngine 作为独立 Service 便于单元测试。

## Complexity Tracking

> 无 Constitution 违规，无需记录。
