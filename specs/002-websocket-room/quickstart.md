# Quickstart: WebSocket 房间管理系统

**Feature**: 002-websocket-room | **Date**: 2026-08-02

## 前置条件

- ✅ Monorepo 脚手架已完成（001）
- ✅ `pnpm install` 依赖已安装
- Node.js >= 22.13.0

## 本地启动

### 1. 启动服务端（NestJS + Socket.IO）

```bash
cd apps/server
pnpm dev
# 服务启动在 http://localhost:3000
# WebSocket 服务在 ws://localhost:3000
```

### 2. 启动 Web 客户端（Vite）

```bash
cd apps/web
pnpm dev
# 开发服务器启动在 http://localhost:5173
```

### 3. 测试联机流程

1. 打开浏览器 Tab A → 登录 → 进入联机模式
2. 点击"创建房间" → 记录邀请码
3. 打开浏览器 Tab B（或另一个浏览器） → 登录 → 输入邀请码加入
4. Tab A 确认 Tab B 出现在玩家列表中
5. 房主点击"开始游戏"
6. 绘画者在画布上绘制，观察 Tab B 是否实时同步
7. 非绘画者提交猜词，验证判定和计分

## WebSocket 事件调试

使用 Chrome DevTools → Network → WS → 查看 Socket.IO 帧

或使用 Socket.IO 官方调试工具：
```bash
npx socket.io-client-devtools
```

## 运行测试

```bash
# 服务端单元测试
cd apps/server
pnpm test

# Web 端测试
cd apps/web
pnpm test
```

## 关键文件索引

| 文件 | 用途 |
|------|------|
| `apps/server/src/gateway/room.gateway.ts` | Socket.IO 事件路由 |
| `apps/server/src/services/room-manager.service.ts` | 房间状态管理 |
| `apps/server/src/services/game-engine.service.ts` | 游戏逻辑引擎 |
| `apps/web/src/services/socket.service.ts` | 客户端 Socket.IO 封装 |
| `packages/shared/src/types/game.ts` | 共享游戏类型 |
