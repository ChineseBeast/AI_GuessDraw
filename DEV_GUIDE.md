# AI_GuessDraw 项目开发指南

## 项目概览

**你画我猜 AI（Draw & Guess AI）** — AI 驱动的你画我猜游戏，支持单机、联机、故事三种模式。当前版本 v0.4.1。

仓库：`github.com:ChineseBeast/AI_GuessDraw.git`。当前故事模式开发分支 `dev-gd`；前端固定使用 MiniMax-M3，`main` 为稳定分支。

> ⚠️ 本文档已按 `dev-xj` 实际源码校对。更详细的审计结论与已知问题清单见 [`HANDOVER.md`](./HANDOVER.md)（两者一致，以 HANDOVER 为权威）。

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

| 包                | 技术栈                  | 端口 | 职责                                                                                           |
| ----------------- | ----------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| `apps/web`        | React 18 + Vite 5       | 5173 | 单机/联机/排行榜/认证页面，useState 手动路由（无 react-router）                                |
| `apps/server`     | NestJS 10 + Socket.IO 4 | 3000 | REST API（`/api/v1` 前缀）+ WebSocket 网关，房间/游戏/认证/排行榜                              |
| `apps/ai-service` | FastAPI + Uvicorn       | 8000 | AI 服务（`/api/v1/ai/recognize` 识别 + `/api/v1/ai/generate-drawing` 绘画，已接入 minimax-m3） |
| `packages/shared` | TypeScript              | —    | 类型定义、常量、工具函数，`types` 字段指向 `src/index.ts`                                      |
| `packages/ui`     | React + TypeScript      | —    | Canvas 组件（Canvas.tsx / Canvas.hooks.ts / Canvas.utils.ts）                                  |

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

| #   | 名称                      | 状态                                                       |
| --- | ------------------------- | ---------------------------------------------------------- |
| 001 | Monorepo 脚手架           | 已完成                                                     |
| 002 | WebSocket 房间系统        | 已完成                                                     |
| 003 | 单机画布与 AI 对战        | 基本完成（识别/绘画已接入真实 AI，待完善猜词/计分/测试等） |
| 004 | 联机画布同步 + 排行榜     | 已完成                                                     |
| 005 | 用户系统（注册/登录/JWT） | 已完成（内存存储，V1）                                     |

---

## 当前实现状态

### 单机模式（5 轮制，固定 MiniMax-M3）

流程：选难度 → **选 AI 画家（MiniMax / 千问）** → 画布绘画 → 提交 → AI 识别猜词 → 轮换角色（`user_draws`/`ai_draws` 按轮次奇偶交替）→ 计分结算 → 5 轮决胜负。

> ⚠️ 仓库中 `apps/ai-service/.env` 的 API key 已清除为占位符，运行前需自行填入（见下文"运行前必配"）。

**我画AI猜（`user_draws`，代码已实现）**

- `apps/ai-service/src/services/minimax_service.py` 按 provider 分支：`qwen` 走千问 OpenAI 兼容端点 / `minimax` 走 MiniMax Anthropic 协议端点识别画作（Canvas PNG 自动转 JPEG，多层容错解析 Top-3 猜测）
- server `SinglePlayerService.recognize()` 经 HTTP 转发到 ai-service（105s 超时）

**AI画我猜（`ai_draws`，代码已实现）**

- `apps/ai-service/src/services/draw_service.py` **两步生成**：先按 `DRAW_PROMPT_TEMPLATE` 生成绘画提示词（提炼 3 个视觉特征），再据提示词输出笔画 JSON（`max_tokens=8192`）
- 笔画数按难度区分（easy 5-10 / medium 8-15 / hard 12-25 笔）；模型失败/超时走 `_fallback_strokes` 兜底几何图形
- server `SinglePlayerService.generateDrawing()` 转发到 ai-service（105s 超时）
- Web 端 ai_draws 回合 `generateAiDrawing()` → Canvas `loadStrokes(strokes, {animate:true})` 动画回放 → 用户猜词
- 猜词最多 3 次（`MAX_GUESSES`），猜错记录历史+字数/首字线索；猜对绿色闪烁动画，轮次切换有过渡动画

### 数据流（单机模式）

```
Web (useSinglePlayer hook / AIService，apps/web/src/services/ai.service.ts，body 含 provider)
  → POST /api/singleplayer/{word|recognize|generate-drawing}
  → vite dev proxy 重写 /api → /api/v1
  → POST /api/v1/singleplayer/*  (NestJS controller)
  → SinglePlayerService.recognize()/generateDrawing()  (HTTP 调用 ai-service)
  → ai-service /api/v1/ai/recognize | /api/v1/ai/generate-drawing
  → 按 provider 调模型：qwen（OpenAI 兼容）/ minimax（Anthropic 协议）
  → 返回 AIRecognizeResponse / AIDrawResponse
```

注意：Web 端 `AIService` 请求 `/api/singleplayer/*`，由 vite proxy 重写为 `/api/v1/singleplayer/*`（server globalPrefix 为 `/api/v1`），dev 环境下路由已匹配；生产部署需在网关配置同等重写。

### 联机模式（已修复并回归验证）

WebSocket 房间系统：创建/加入/离开房间、画布实时同步、猜词、回合管理、断线重连。WebSocket 连接支持 JWT 认证（`handleConnection` 中内联验证 token，`getUserId`/`getNickname` 优先使用 JWT 验证结果，回退到 `handshake.auth` 游客模式）。

### 用户系统与用户管理模块（已实现并验证）

注册/登录（用户名+密码，bcrypt 哈希）、JWT 鉴权（集中配置于 `app.config.ts`）、游客模式、WebSocket 连接认证。

**用户管理 REST API（全部已端到端验证通过）**：

| 方法     | 路径                                      | 认证 | 功能                                     |
| -------- | ----------------------------------------- | ---- | ---------------------------------------- |
| `POST`   | `/api/v1/auth/register`                   | 公开 | 注册（username + password + 可选 email） |
| `POST`   | `/api/v1/auth/login`                      | 公开 | 登录，返回 JWT                           |
| `GET`    | `/api/v1/auth/me`                         | JWT  | 获取当前用户资料（含 stats 统计）        |
| `PATCH`  | `/api/v1/auth/me`                         | JWT  | 更新资料（username / email / avatar）    |
| `POST`   | `/api/v1/auth/me/change-password`         | JWT  | 修改密码（需验证当前密码）               |
| `DELETE` | `/api/v1/auth/me`                         | JWT  | 注销账号（需验证密码）                   |
| `GET`    | `/api/v1/auth/profile/:id`                | 公开 | 按 ID 查询用户公开资料                   |
| `GET`    | `/api/v1/auth/profile/username/:username` | 公开 | 按用户名查询用户公开资料                 |

**UserRecord 数据结构**：`id` / `username` / `email?` / `avatar?` / `passwordHash` / `createdAt` / `updatedAt` / `stats: { gamesPlayed, gamesWon, totalScore, currentStreak }`。`PublicUserProfile` 类型排除 `passwordHash`。

**前端页面**：

- `ProfilePage`（`apps/web/src/pages/profile/index.tsx`）：用户资料展示与编辑、游戏统计卡片
- `SettingsPage`（`apps/web/src/pages/settings/index.tsx`）：修改密码、退出登录、注销账号
- 首页用户栏：已登录显示头像/设置/退出按钮，未登录显示登录/注册按钮

**JWT 配置集中管理**：`apps/server/src/config/app.config.ts` 统一管理 `jwt.secret`、`jwt.expiresInSeconds`、`server.port`、`aiService.url` 等配置项，`auth.module.ts` 和 `jwt.strategy.ts` 均引用 `appConfig`，不再硬编码。

用户数据存储：内存 Map + 文件持久化（`apps/server/data/users.json`），注册/更新统计/修改资料等操作自动落盘，服务器重启不丢数据。`usernameIndex` 维护用户名→ID 的索引，支持快速查找和唯一性校验。

### 后台管理模块（已实现并端到端验证 ✅）

第一个注册用户自动成为 `admin`，其余为 `user`。AdminGuard（继承 `AuthGuard('jwt')`）在 `handleRequest` 中校验 `user.role === 'admin'`，非管理员返回 403「需要管理员权限」/「需要登录」。

**Admin REST API（全部已端到端验证通过，统一前缀 `/api/v1/admin`，需 admin JWT）**：

| 方法     | 路径                        | 功能                                                          |
| -------- | --------------------------- | ------------------------------------------------------------- |
| `GET`    | `/dashboard`                | 仪表盘统计（用户/房间/游戏/排行榜计数）                       |
| `GET`    | `/users?limit&offset`       | 用户列表（按 createdAt 倒序分页）                             |
| `DELETE` | `/users/:id`                | 删除用户                                                      |
| `POST`   | `/users/:id/reset-password` | 重置用户密码（body: `{newPassword}` ≥6 位）                   |
| `PATCH`  | `/users/:id/role`           | 切换角色（body: `{role: 'user'\|'admin'}`）                   |
| `GET`    | `/rooms`                    | 房间列表（含 playerCount/spectatorCount）                     |
| `DELETE` | `/rooms/:id`                | 强制关闭房间                                                  |
| `GET`    | `/words`                    | 词库列表（easy/medium/hard 三个数组）                         |
| `POST`   | `/words`                    | 添加单个词汇（body: `{difficulty, word}`）                    |
| `POST`   | `/words/batch`              | 批量添加（body: `{difficulty, words[]}`，返回 added/skipped） |
| `DELETE` | `/words/:difficulty/:word`  | 删除词汇（word 需 URL 编码）                                  |

**关键文件**：

- 后端：`apps/server/src/modules/admin/{admin.module,admin.controller,admin.service,admin.types}.ts`
- 鉴权：`apps/server/src/modules/auth/guards/admin.guard.ts`
- 前端：`apps/web/src/pages/admin/index.tsx`（4 个 tab：仪表盘/用户/房间/词库）
- 前端服务：`apps/web/src/services/admin.service.ts`

**UI 交互要点**：

- 词库管理使用内联输入框 + 「+ 添加」按钮（支持回车提交），**不使用 `prompt()`**（避免在沙箱浏览器/移动端失效）
- 用户删除/房间关闭使用二次确认模式（点击「删除」→ 按钮变「确认删除」+「取消」）
- 密码重置使用内联表单（点击「重置密码」→ 出现输入框 + 「确认重置」/「取消」）
- AdminGuard 阻止非 admin 访问时，前端会显示错误提示

### 单机模式待完善（相对 spec 003）

- 猜词交互：猜错直接进入轮次结算，spec 003 US2 要求可继续猜直至猜对/超时
- 猜词超时：ai_draws 回合倒计时归零后未自动结算（仅用户绘画回合有超时自动提交）
- 计分规则：Web 端当前为 1 分制简化计分，spec US5 要求 10 分制 + 时间/置信度奖励（server 已有 `calculateScore` 未被 Web 使用）
- AI 服务降级：spec SP-015 要求识别超时/不可用时提供重试 + 30% 随机匹配降级（当前仅友好错误提示）
- 未完成任务：Toolbar/Timer/快捷键/响应式测试（T027/T041/T052）、页面过渡动画（T055）、全量测试（T059）、quickstart（T060）

### 未实现

- 故事模式（三主题、三章节、AI/降级评价与分支结局已实现）
- 小程序端功能（仅脚手架）
- SQLite/PostgreSQL 数据库迁移（当前用文件持久化兜底）

---

## 关键类型定义

### AI 识别（`packages/shared/src/types/singleplayer.ts`）

```typescript
interface AIGuess {
  word: string;
  confidence: number; // 0-1
}

interface AIRecognizeRequest {
  image: string; // Base64 PNG（含 data:image/png;base64, 前缀）
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

### 用户管理类型（`packages/shared/src/types/user.ts`）

```typescript
interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  currentStreak: number;
}

interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  stats?: UserStats;
}

interface UpdateProfileRequest {
  username?: string;
  email?: string;
  avatar?: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}
```

---

## AI 服务接入 minimax-m3 的要点

### 当前实现（已完成）

- `apps/ai-service/src/routers/ai.py`：`/api/v1/ai/recognize`（识别）+ `/api/v1/ai/generate-drawing`（笔画轨迹生成）
- `apps/ai-service/src/services/minimax_service.py`：调用 minimax-m3 多模态 API 识别简笔画（PNG 自动转 JPEG）
- `apps/ai-service/src/services/draw_service.py`：调用 minimax-m3 生成笔画轨迹（3-15 笔/词）
- 依赖含 `httpx`（HTTP 客户端）+ `Pillow`（图片转码），API key 经 `.env`/环境变量注入
- NestJS server 的 `SinglePlayerService.recognize()/generateDrawing()` 已改为 HTTP 调用 ai-service

### 运行前必配（关键）

仓库只提交了 `.env.example`，**无 `.env`、无实时密钥**，运行前需自备：

```bash
# apps/ai-service/.env
# MiniMax 官方端点（sk-api-* 格式密钥）
MINIMAX_API_KEY=sk-api-xxxxxxx
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
MINIMAX_MODEL=MiniMax-M3

# 亦可配置为千问（火山方舟 OpenAI 兼容端点）：
# MINIMAX_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3
# MINIMAX_MODEL=minimax-m3

# Anthropic 兼容端点（provider=minimax 走此通道，同一密钥）
MINIMAX_ANTHROPIC_API_KEY=sk-api-xxxxxxx
MINIMAX_ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
MINIMAX_ANTHROPIC_MODEL=MiniMax-M3
```

```bash
# apps/server/.env
AI_SERVICE_URL=http://localhost:8000
```

### Python 环境搭建（无 root 场景）

ai-service 要求 Python >= 3.11，若系统版本较低（如 Ubuntu 22.04 自带 3.10），可用 **uv**（无需 root）安装：

```bash
pip3 install --user uv                    # 安装 uv
uv python install 3.11                     # 下载独立 CPython 3.11
cd apps/ai-service
uv venv --python 3.11 .venv                # 创建虚拟环境
uv pip install fastapi "uvicorn[standard]" pydantic httpx python-dotenv Pillow
.venv/bin/python src/main.py               # 启动 ai-service
```

### 接入路径（已完成）

1. **ai-service 端**：`/api/v1/ai/recognize` 接收 `AIRecognizeRequest`，调用 minimax-m3 多模态 API 识别图片，返回 `AIRecognizeResponse`
2. **server 端**：`SinglePlayerService.recognize()` 已从 mock 改为 HTTP 调用 ai-service 的 `/api/v1/ai/recognize`
3. **环境变量**：minimax API key 等敏感信息经 `.env`/环境变量注入，不硬编码
4. **降级方案**：ai-service 不可用时返回友好错误（HTTP 503），前端已有 `AI_SERVICE_UNAVAILABLE` 错误处理

### minimax-m3 模型信息

- "公司 API" = 字节火山方舟（Volcano Ark）OpenAI 兼容端点 `https://ark.cn-beijing.volces.com/api/coding/v3`，服务模型 `minimax-m3`（向 `{MINIMAX_BASE_URL}/chat/completions` 发起请求）
- 代码保留 `MINIMAX_*` 命名与 `minimax_service.py`，但实际 provider 是火山方舟，非 MiniMax 官方 `https://api.minimaxi.com/v1`（后者在 `.env.example` 作为可替代方案记录）
- minimax-m3 为多模态推理模型，支持图像理解（识别）与文本结构化输出（笔画轨迹 JSON）
- 需要通过 HTTP 调用其 Chat Completion API，传入图片 base64 + prompt；缺 key 时两服务分别抛 `MiniMaxError` / `DrawError` → 路由返回 503 `AI_SERVICE_UNAVAILABLE`

---

## 提示词模版

以下模版用于在新的 Claude Code 会话中快速恢复上下文并开始开发。复制后根据当次任务修改 `## 本次任务` 部分即可。

```markdown
# 任务上下文

我在开发一个 AI 驱动的你画我猜游戏项目（AI_GuessDraw），Monorepo 结构（Turborepo + pnpm workspace），包含 6 个包：

- apps/web — React 18 + Vite 前端（useState 手动路由）
- apps/server — NestJS 10 后端（REST API `/api/v1` 前缀 + WebSocket 网关，端口 3000）
- apps/ai-service — FastAPI (Python) AI 服务（端口 8000，识别/绘画）
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

当前状态（分支 `dev-xj`）：

- **固定 MiniMax-M3**：单机模式选完难度后直接开始，不再展示「选择 AI 画家」页；前端以 `provider=minimax` 通过 web → server → ai-service 全链路透传。
- **我画AI猜（user_draws）**：Canvas 提交 → `AIService.recognize` → server 转发 → ai-service 按 provider 调模型识别
- **AI画我猜（ai_draws）代码已实现**：`draw_service` **两步生成**——先按 `DRAW_PROMPT_TEMPLATE` 让模型生成绘画提示词（提炼 3 个视觉特征），再据提示词输出笔画 JSON。笔画数按难度区分（easy 5-10 / medium 8-15 / hard 12-25 笔）；模型失败/超时走 `_fallback_strokes` 兜底。**需配 key 后实测效果**
- **多次猜测**：ai_draws 回合最多猜 3 次（`MAX_GUESSES`），猜错记录到 `userGuesses`、给字数+首字线索、继续猜；猜对或用完次数结算。猜对有绿色闪烁动画
- **画布**：Canvas 容器 2px 黑边 + 圆角 8px + maxWidth 560 居中（边框放容器避免残缺）
- **用户管理模块（已实现并验证）**：注册/登录/改密/改资料/注销/公开查询全链路打通；JWT 配置集中到 `app.config.ts`；WebSocket 网关内联 JWT 验证；前端 ProfilePage + SettingsPage
- **用户数据持久化**：AuthService 已添加文件持久化（`apps/server/data/users.json`），注册、更新统计、修改资料等操作自动落盘，服务器重启后数据不丢失
- **联机模式（已修复并验证）**：WebSocket 连接（CORS/事件桥接/断线重连）、房间创建/加入、游戏开始、回合管理（绘画→猜词→结算）、画布实时同步、猜词反馈、排行榜提交均已调通
  - 绘画者端：画布 + 工具栏 +「完成绘画」提交按钮
  - 猜词者端：实时显示同步笔画 + 猜词输入框 + 猜对排名
  - 回合结束原因支持 `all_guessed` / `timeout` / `drawer_submitted`
- **运行配置**：`apps/ai-service/.env` 需自配 `MINIMAX_API_KEY` 与 `MINIMAX_ANTHROPIC_API_KEY`（MiniMax 官方 `sk-api-*` 密钥）；`apps/server/.env` 配 `AI_SERVICE_URL=http://localhost:8000`；Python 环境用 uv 安装 3.11（无 root 场景）
- 超时：ai-service 识别 90s / 绘画两步各 30s+60s 总超时；server 转发 105s；超时兜底简笔画保证链路不断
- 故事模式 Web 端已完成；小程序端故事功能未开始

关键类型（`packages/shared/src/types/`）：

- `Provider = 'qwen' | 'minimax'`（types/game.ts）；`PROVIDER_LEVELS`（constants/game.ts）
- AIRecognizeRequest: { image, targetWord, difficulty, provider }
- AIRecognizeResponse: { guesses: {word, confidence}[], isCorrect, matchedGuess?, processingTime }
- AIDrawRequest: { targetWord, difficulty, provider }
- AIDrawResponse: { strokes: {points: {x,y}[], color, width}[], processingTime }
- `SinglePlayerRound.userGuesses?: string[]`（AI画猜历史）

## 本次任务

（按当次需求填写，示例）完善联机模式体验。已完成方向：

1. **画布同步修复**：修复猜词者看不到绘画的问题——CanvasView 未渲染同步笔画（`loadStrokes`），以及 `sendCanvasAction` 中 `pen/eraser` 类型未映射为 `draw/erase`
2. **绘画提交按钮**：添加「完成绘画」按钮，绘画者可提前提交画作，无需等待 60s 超时
3. **回合结束原因**：`RoundEndReason` 新增 `drawer_submitted`，`broadcastRoundEnd` 使用实际存储的 `endReason` 而非猜测
4. **ExternalStroke 类型扩展**：新增 `tool` 字段支持橡皮擦笔画渲染
5. **撤销/清空防重发**：用 `prevStrokesLengthRef` 追踪笔画数，避免撤消操作触发重复发送
6. **用户数据持久化**：AuthService 文件持久化（`data/users.json`），重启不丢数据
7. **游戏统计显示**：资料页 `refreshUser()` 从 `/me` 获取含 stats 的最新用户数据

可继续方向：

1. **联机体验优化**：断线重连测试、观众模式切换、移动端适配
2. **计分对齐 spec**：Web 端当前每轮 +1 简化计分，spec US5 要求 10 分制
3. **猜词超时**：ai_draws 回合倒计时归零后自动结算
4. **词库扩展**：添加词库类别（名词/动词），支持语义提示
5. **数据库迁移**：从文件/内存存储迁移到 SQLite/PostgreSQL
6. **小程序端功能**：从脚手架补全联机功能

请先阅读相关文件了解现有实现，然后给出修改方案。
```

---

## 文件速查

| 功能                            | 文件路径                                                          |
| ------------------------------- | ----------------------------------------------------------------- |
| Web 入口/路由                   | `apps/web/src/main.tsx`                                           |
| 单机模式 hook                   | `apps/web/src/hooks/useSinglePlayer.ts`                           |
| 单机模式页面                    | `apps/web/src/pages/singleplayer/index.tsx` + `game.tsx`          |
| Web AI 服务客户端               | `apps/web/src/services/ai.service.ts`                             |
| Web 认证服务                    | `apps/web/src/services/auth.service.ts`                           |
| Web 认证 Hook                   | `apps/web/src/hooks/useAuth.ts`                                   |
| 用户资料页                      | `apps/web/src/pages/profile/index.tsx`                            |
| 设置页                          | `apps/web/src/pages/settings/index.tsx`                           |
| Server 入口                     | `apps/server/src/main.ts`                                         |
| Server 模块注册                 | `apps/server/src/app.module.ts`                                   |
| **Server 配置中心**             | `apps/server/src/config/app.config.ts`                            |
| 单机 controller                 | `apps/server/src/modules/singleplayer/singleplayer.controller.ts` |
| 单机 service（转发 ai-service） | `apps/server/src/modules/singleplayer/singleplayer.service.ts`    |
| 单机类型                        | `apps/server/src/modules/singleplayer/singleplayer.types.ts`      |
| WebSocket 网关                  | `apps/server/src/gateway/room.gateway.ts`                         |
| WebSocket 认证守卫（可选）      | `apps/server/src/gateway/ws-auth.guard.ts`                        |
| 游戏引擎                        | `apps/server/src/services/game-engine.service.ts`                |
| 词库服务                        | `apps/server/src/gateway/word.service.ts`                         |
| 认证模块                        | `apps/server/src/modules/auth/`                                   |
| 认证类型定义                    | `apps/server/src/modules/auth/auth.types.ts`                      |
| 认证服务                        | `apps/server/src/modules/auth/auth.service.ts`                    |
| 认证控制器                      | `apps/server/src/modules/auth/auth.controller.ts`                 |
| JWT 策略                        | `apps/server/src/modules/auth/strategies/jwt.strategy.ts`         |
| Admin Guard                     | `apps/server/src/modules/auth/guards/admin.guard.ts`              |
| 后台管理模块                    | `apps/server/src/modules/admin/`                                  |
| 后台管理控制器                  | `apps/server/src/modules/admin/admin.controller.ts`               |
| 后台管理服务                    | `apps/server/src/modules/admin/admin.service.ts`                  |
| 后台管理前端页                  | `apps/web/src/pages/admin/index.tsx`                              |
| 后台管理前端服务                | `apps/web/src/services/admin.service.ts`                          |
| 排行榜模块                      | `apps/server/src/modules/leaderboard/`                            |
| AI 服务入口                     | `apps/ai-service/src/main.py`                                     |
| AI 服务路由                     | `apps/ai-service/src/routers/ai.py`                               |
| 识别服务（minimax-m3）          | `apps/ai-service/src/services/minimax_service.py`                 |
| 绘画服务（笔画生成）            | `apps/ai-service/src/services/draw_service.py`                    |
| AI 服务配置                     | `apps/ai-service/src/config.py`                                   |
| AI 服务依赖                     | `apps/ai-service/requirements.txt` / `pyproject.toml`             |
| 共享类型                        | `packages/shared/src/types/`                                      |
| 共享用户类型                    | `packages/shared/src/types/user.ts`                               |
| 共享常量                        | `packages/shared/src/constants/`                                  |
| 共享入口                        | `packages/shared/src/index.ts`                                    |
| Canvas 组件                     | `packages/ui/src/components/Canvas/`                              |
| ESLint 配置                     | `eslint.config.mjs`                                               |
| Turbo 配置                      | `turbo.json`                                                      |
| CI 配置                         | `.github/workflows/ci.yml`                                        |
| Commit 规范                     | `commitlint.config.mjs`                                           |
| 项目治理文件                    | `.specify/memory/constitution.md`                                 |
