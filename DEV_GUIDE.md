# AI_GuessDraw 项目开发指南

## 项目概览

**你画我猜 AI（Draw & Guess AI）** — AI 驱动的你画我猜游戏，支持单机、联机、故事三种模式。当前版本 v0.3.0。

仓库：`github.com:ChineseBeast/AI_GuessDraw.git`，分支 `main`。

---

## Monorepo 结构

Turborepo + pnpm workspace（catalog 模式统一依赖版本），6 个包：

```
AI_GuessDraw/
├── apps/
│   ├── web/              # React 18 + Vite + TypeScript — Web 前端
│   ├── miniprogram/      # Taro 4 + React — 微信小程序（仅脚手架）
│   ├── server/           # NestJS 10 + Socket.IO — 后端 API + WS 网关
│   └── ai-service/       # FastAPI (Python) — AI 识别/绘画/故事服务
├── packages/
│   ├── shared/           # 跨端共享类型、常量、工具函数（composite: true）
│   └── ui/               # 共享 UI 组件（Canvas 画布组件）
├── specs/                # SpecKit 规范文件（001-005）
├── turbo.json
├── pnpm-workspace.yaml   # catalog 依赖版本管理
├── tsconfig.base.json
├── eslint.config.mjs
└── package.json
```

### 各包技术栈与端口

| 包 | 技术栈 | 端口 | 职责 |
|---|---|---|---|
| `apps/web` | React 18 + Vite 5 | 5173 | 单机/联机/排行榜/认证页面，useState 手动路由（无 react-router） |
| `apps/server` | NestJS 10 + Socket.IO 4 | 3000 | REST API（`/api/v1` 前缀）+ WebSocket 网关，房间/游戏/认证/排行榜 |
| `apps/ai-service` | FastAPI + Uvicorn | 8000 | AI 服务（目前仅 `/health` 和 `/api/v1/info`，待接入模型） |
| `packages/shared` | TypeScript | — | 类型定义、常量、工具函数，`types` 字段指向 `src/index.ts` |
| `packages/ui` | React + TypeScript | — | Canvas 组件（Canvas.tsx / Canvas.hooks.ts / Canvas.utils.ts） |

### 包间依赖关系

```
web ──→ shared, ui
server ──→ shared
ui ──→ shared
ai-service（独立，不依赖 TS 包）
```

`packages/shared` 是 `composite: true` 项目，`package.json` 的 `types` 指向源码 `./src/index.ts`。各消费方通过 workspace symlink 直接引用源码，**不要**在消费方的 `tsconfig.json` 中添加 `references`（会导致 TS6305 错误）。

---

## 开发命令

```bash
pnpm install              # 安装依赖
pnpm dev                  # 启动所有包的 dev 模式
pnpm build                # 构建所有包
pnpm lint                 # ESLint 检查（turbo 并行）
pnpm lint:fix             # ESLint 自动修复
pnpm typecheck            # TypeScript 类型检查（turbo 并行）
pnpm test                 # 运行测试
pnpm clean                # 清理所有构建产物和 node_modules

# 单包操作
pnpm --filter @draw-guess/web dev
pnpm --filter @draw-guess/server dev
pnpm --filter @draw-guess/shared build

# AI 服务（Python）
cd apps/ai-service
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Node >= 22.13.0，pnpm >= 10.8.0。

---

## 代码规范

### ESLint

- Flat config（`eslint.config.mjs`）
- 启用 `consistent-type-imports`：仅用于类型的导入必须写 `import type`
- **server 例外**：`apps/server/src/**/*.ts` 关闭了 `consistent-type-imports`，因为 NestJS DI 依赖 `emitDecoratorMetadata`，构造函数注入的 provider 必须用值导入
- 忽略 `*.spec.ts` 测试文件

### Prettier

单引号 | 分号 | 120 字宽 | 尾逗号 all | 2 空格缩进 | LF 换行

### Commit 规范（Conventional Commits）

```
<type>(<scope>): <subject>
```

- **type**: `feat | fix | docs | style | refactor | test | chore | spec | perf | ci | build | revert`
- **scope**: `web | miniprogram | server | ai-service | shared | design | test | spec | repo`

示例：`feat(ai-service): 接入 minimax-m3 图像识别`、`fix(server): 修复房间断线重连状态丢失`

### Git Hooks

- **pre-commit**: `pnpm lint-staged`（对暂存的 `.ts/.tsx/.js/.jsx` 跑 eslint + prettier）
- **commit-msg**: `pnpm commitlint --edit`

### CI（GitHub Actions，`.github/workflows/ci.yml`）

PR/push 到 `main`/`develop` 时触发：lint → typecheck → build（三阶段，build 依赖前两者通过）。

---

## 开发流程（Spec-First，强制执行）

项目遵循 SpecKit 规范驱动流程，**禁止跳过规范直接编码**：

```
Spec (specs/NNN-xxx/spec.md)  →  定义 WHAT 和 WHY
  ↓
Plan (plan.md)                 →  定义 HOW
  ↓
Tasks (tasks.md)               →  拆分执行项
  ↓
Implement                      →  编码
```

### 已有 Specs

| # | 名称 | 状态 |
|---|---|---|
| 001 | Monorepo 脚手架 | 已完成 |
| 002 | WebSocket 房间系统 | 已完成 |
| 003 | 单机画布与 AI 对战 | 已完成（AI 识别为 mock） |
| 004 | 联机画布同步 + 排行榜 | 已完成 |
| 005 | 用户系统（注册/登录/JWT） | 已完成（内存存储，V1） |

---

## 当前实现状态

### 单机模式（可玩，AI 为 mock）

流程：选难度 → 画布绘画 → 提交 → AI 识别猜词 → 轮换角色（用户画/AI画）→ 计分结算 → 5 轮决胜负。

**AI 识别目前是纯 mock**（`apps/server/src/modules/singleplayer/singleplayer.service.ts`）：
- 按难度模拟正确率（easy 80% / medium 60% / hard 40%）
- 200-800ms 随机延迟
- 5% 概率模拟服务不可用
- 返回固定格式的 `AIRecognizeResponse`

**需要接入真实 AI**：用户计划接入 **minimax-m3** 模型。

### 数据流（单机模式）

```
Web (useSinglePlayer hook)
  → AIService.recognize()  (apps/web/src/services/ai.service.ts)
  → POST /api/singleplayer/recognize  (NestJS controller)
  → SinglePlayerService.recognize()   (mock 实现)
  → 返回 AIRecognizeResponse
```

注意：当前 API 路由是 `/api/singleplayer/*`（server 的 globalPrefix 是 `/api/v1`，但 controller 装饰器是 `@Controller('singleplayer')`，实际路径为 `/api/v1/singleplayer/*`）。Web 端 `AIService` 请求的是 `/api/singleplayer`，可能有路由不匹配的问题，接入时需确认。

### 联机模式（基本完整）

WebSocket 房间系统：创建/加入/离开房间、画布实时同步、猜词、回合管理、断线重连。

### 用户系统（V1，内存存储）

注册/登录（用户名+密码）、JWT 鉴权、游客模式、WebSocket 连接认证。用户数据存储在内存 Map 中，后续需迁移至数据库。

### 未实现

- 故事模式（Spec 中有规划，未开始）
- 小程序端功能（仅脚手架）
- 数据库持久化
- AI 绘画生成（AI 画用户猜的回合，目前只支持用户画 AI 猜）

---

## 关键类型定义

### AI 识别（`packages/shared/src/types/singleplayer.ts`）

```typescript
interface AIGuess {
  word: string;
  confidence: number; // 0-1
}

interface AIRecognizeRequest {
  image: string;        // Base64 PNG（含 data:image/png;base64, 前缀）
  targetWord: string;
  difficulty: Difficulty; // 'easy' | 'medium' | 'hard'
}

interface AIRecognizeResponse {
  guesses: AIGuess[];
  isCorrect: boolean;
  matchedGuess?: AIGuess;
  processingTime: number;
}
```

### 难度（`packages/shared/src/types/game.ts`）

```typescript
type Difficulty = 'easy' | 'medium' | 'hard';
```

### 共享 API 路由常量（`packages/shared/src/constants/api.ts`）

```typescript
const API_ROUTES = {
  AI: {
    RECOGNIZE: '/api/v1/ai/recognize',
    GENERATE_DRAWING: '/api/v1/ai/generate-drawing',
    GENERATE_STORY: '/api/v1/ai/generate-story',
    EVALUATE_DRAWING: '/api/v1/ai/evaluate-drawing',
  },
  // ...
};
```

---

## AI 服务接入 minimax-m3 的要点

### 当前状态

- `apps/ai-service/src/main.py` 仅有 `/health` 和 `/api/v1/info` 两个端点
- `src/routers/` 和 `src/services/` 目录为空
- 依赖仅 `fastapi + uvicorn + pydantic`，未包含 HTTP 客户端和 AI SDK
- NestJS server 的 `SinglePlayerService.recognize()` 是 mock，未调用 ai-service

### 接入路径

1. **ai-service 端**：新增 `/api/v1/ai/recognize` 路由，接收 `AIRecognizeRequest`，调用 minimax-m3 多模态 API 识别图片，返回 `AIRecognizeResponse`
2. **server 端**：将 `SinglePlayerService.recognize()` 从 mock 改为 HTTP 调用 ai-service 的 `/api/v1/ai/recognize`
3. **环境变量**：minimax API key 等敏感信息通过环境变量注入，不硬编码
4. **降级方案**：ai-service 不可用时返回友好错误，前端已有 `AI_SERVICE_UNAVAILABLE` 错误处理

### minimax-m3 模型信息

- minimax-m3 是 MiniMax 的多模态大模型，支持图像理解
- API 文档：https://www.minimaxi.com/document
- 需要通过 HTTP 调用其 Chat Completion API，传入图片 base64 + prompt

---

## 提示词模版

以下模版用于在新的 Claude Code 会话中快速恢复上下文并开始开发。复制后根据当次任务修改 `## 本次任务` 部分即可。

```markdown
# 任务上下文

我在开发一个 AI 驱动的你画我猜游戏项目（AI_GuessDraw），Monorepo 结构（Turborepo + pnpm workspace），包含 6 个包：
- apps/web — React 18 + Vite 前端
- apps/server — NestJS 10 后端（REST API `/api/v1` 前缀 + WebSocket 网关，端口 3000）
- apps/ai-service — FastAPI (Python) AI 服务（端口 8000，目前仅 health check）
- apps/miniprogram — Taro 4 小程序（仅脚手架）
- packages/shared — 共享类型/常量/工具（TypeScript composite 项目）
- packages/ui — 共享 Canvas 组件

技术规范：
- ESLint flat config，启用 consistent-type-imports（server 除外，NestJS DI 需要 emitDecoratorMetadata）
- Prettier：单引号、分号、120 字宽、尾逗号 all
- Commit：Conventional Commits，type 限定（feat/fix/docs/refactor 等），scope 限定（web/server/ai-service/shared 等）
- CI：GitHub Actions 跑 lint → typecheck → build
- 开发流程：Spec-First（specs/ 目录），禁止跳过规范直接编码
- packages/shared 的 types 指向源码 src/index.ts，消费方 tsconfig 不要加 references

当前状态：
- 单机模式可玩但 AI 识别是 mock（apps/server/src/modules/singleplayer/singleplayer.service.ts 中按难度随机猜对/猜错）
- 联机模式基本完整（WebSocket 房间 + 画布同步 + 猜词）
- 用户系统 V1（内存存储，JWT 鉴权）
- 故事模式未开始，小程序仅脚手架

关键类型：
- AIRecognizeRequest: { image: string (base64 PNG), targetWord: string, difficulty: 'easy'|'medium'|'hard' }
- AIRecognizeResponse: { guesses: {word, confidence}[], isCorrect: boolean, matchedGuess?: {word, confidence}, processingTime: number }
- 共享包索引：packages/shared/src/index.ts

## 本次任务

接入 minimax-m3 模型替换 mock AI 识别。具体要求：

1. 在 apps/ai-service 中新增 /api/v1/ai/recognize 路由，接收 AIRecognizeRequest，调用 minimax-m3 多模态 API 识别图片，返回 AIRecognizeResponse
2. 将 apps/server 的 SinglePlayerService.recognize() 从 mock 改为 HTTP 调用 ai-service
3. minimax API key 通过环境变量注入
4. ai-service 不可用时返回友好错误，前端已有 AI_SERVICE_UNAVAILABLE 处理
5. 保持现有类型契约不变，不改 packages/shared 中的类型定义

请先阅读相关文件了解现有实现，然后给出修改方案。
```

---

## 文件速查

| 功能 | 文件路径 |
|---|---|
| Web 入口/路由 | `apps/web/src/main.tsx` |
| 单机模式 hook | `apps/web/src/hooks/useSinglePlayer.ts` |
| 单机模式页面 | `apps/web/src/pages/singleplayer/index.tsx` + `game.tsx` |
| Web AI 服务客户端 | `apps/web/src/services/ai.service.ts` |
| Server 入口 | `apps/server/src/main.ts` |
| Server 模块注册 | `apps/server/src/app.module.ts` |
| 单机 controller | `apps/server/src/modules/singleplayer/singleplayer.controller.ts` |
| 单机 service（mock AI） | `apps/server/src/modules/singleplayer/singleplayer.service.ts` |
| 单机类型 | `apps/server/src/modules/singleplayer/singleplayer.types.ts` |
| WebSocket 网关 | `apps/server/src/gateway/room.gateway.ts` |
| 认证模块 | `apps/server/src/modules/auth/` |
| 排行榜模块 | `apps/server/src/modules/leaderboard/` |
| AI 服务入口 | `apps/ai-service/src/main.py` |
| AI 服务依赖 | `apps/ai-service/requirements.txt` / `pyproject.toml` |
| 共享类型 | `packages/shared/src/types/` |
| 共享常量 | `packages/shared/src/constants/` |
| 共享入口 | `packages/shared/src/index.ts` |
| Canvas 组件 | `packages/ui/src/components/Canvas/` |
| ESLint 配置 | `eslint.config.mjs` |
| Turbo 配置 | `turbo.json` |
| CI 配置 | `.github/workflows/ci.yml` |
| Commit 规范 | `commitlint.config.mjs` |
| 项目治理文件 | `.specify/memory/constitution.md` |
