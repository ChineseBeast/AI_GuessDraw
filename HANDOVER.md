# 📋 交接文档（HANDOVER）

> **给下一个 AI 智体：请优先阅读本文档，再读取其他任何文件。**
>
> 本文档基于 **`dev-xj` 分支实际源码**核对而成，反映真实功能状态。
> 注意：`DEV_GUIDE.md` 描述的是 `main` 分支，内容与 `dev-xj` 现状有出入（见末尾「与 DEV_GUIDE 的差异」），**以本文档为准**。

---

## 0. 一句话定位

`AI_GuessDraw`（AI 你画我猜）—— AI 驱动的你画我猜游戏，支持单机 / 联机 / 故事三种模式。当前分支 `dev-xj` 的核心改动：**接入双 AI provider（通义千问 `qwen3.7-flash` + MiniMax `MiniMax-M3`），单机模式可切换模型；AI 画我猜改为两步生成（先绘画提示词再笔画）；用户管理模块完善（资料编辑/改密/注销/公开查询 + JWT 配置集中化 + WebSocket 认证修复）；AI Service 可通过 uv 在无 root 环境运行**。

- 仓库：`https://github.com/ChineseBeast/AI_GuessDraw.git`
- 当前分支：`dev-xj`（tracking `origin/dev-xj`）
- 版本：v0.4.0（用户管理模块 + 环境修复）

---

## 1. 技术栈与结构（Monorepo：Turborepo + pnpm workspace）

```
AI_GuessDraw/
├── apps/
│   ├── web/           # React 18 + Vite 5，端口 5173 —— 前端（useState 手动路由，无 react-router）
│   ├── server/        # NestJS 10 + Socket.IO 4，端口 3000 —— 后端 REST（/api/v1 前缀）+ WS 网关
│   ├── ai-service/    # FastAPI (Python)，端口 8000 —— AI 识别/绘画服务
│   └── miniprogram/   # Taro 4 —— 仅脚手架，未实现
├── packages/
│   ├── shared/        # 跨端共享类型/常量/工具（composite: true，types 指向 src/index.ts）
│   └── ui/            # 共享 Canvas 组件
├── specs/             # SpecKit 规范（001-005）
├── DEV_GUIDE.md       # ⚠️ 描述 main 分支，与 dev-xj 现状有出入
└── HANDOVER.md        # 本文档
```

| 包                | 端口 | 职责                                                             |
| ----------------- | ---- | ---------------------------------------------------------------- |
| `apps/web`        | 5173 | 单机/联机/排行榜/认证/用户资料/设置页面                          |
| `apps/server`     | 3000 | REST `/api/v1` + WebSocket 网关                                  |
| `apps/ai-service` | 8000 | `/api/v1/ai/recognize` 识别 + `/api/v1/ai/generate-drawing` 绘画 |

**包间依赖**：web → shared, ui；server → shared；ui → shared；ai-service 独立（不依赖 TS 包）。

⚠️ `packages/shared` 是 `composite: true`，`types` 指向源码 `./src/index.ts`。各消费方通过 workspace symlink 直接引用源码——**不要在消费方 tsconfig 加 `references`**（会触发 TS6305）。

---

## 2. 启动方式

### 2.1 TS 侧（前端 + 后端）

```bash
# Node ≥ 22.13.0，pnpm ≥ 10.8.0
# 若系统 Node 版本低，用 nvm 切换：nvm use 22
pnpm install
pnpm dev                  # turbo 并行启动所有包

# 单包
pnpm --filter @draw-guess/web dev
pnpm --filter @draw-guess/server dev
pnpm --filter @draw-guess/shared build   # server 依赖 shared 的 dist/index.js
```

⚠️ 启动 server 前需先构建 shared 包：`pnpm --filter @draw-guess/shared build`。

⚠️ bcrypt 需在 `package.json` 的 `pnpm.approvedBuilds` 中批准，否则密码哈希不可用。

### 2.2 AI 服务（Python）

ai-service 要求 Python >= 3.11。若系统版本较低（如 Ubuntu 22.04 自带 3.10），可用 **uv** 无 root 安装：

```bash
pip3 install --user uv
uv python install 3.11
cd apps/ai-service
uv venv --python 3.11 .venv
uv pip install fastapi "uvicorn[standard]" pydantic httpx python-dotenv Pillow
.venv/bin/python src/main.py
```

需先配 `.env`（见第 5 节）。

---

## 3. 当前实现状态（基于 dev-xj 实际源码）

### 单机模式（5 轮，双 AI provider 可切换）

流程：选难度 → **选 AI 画家（MiniMax / 千问）** → 画布绘画 → 提交 → AI 识别猜词 → 轮换角色（`user_draws`/`ai_draws` 按轮次奇偶交替）→ 计分结算 → 5 轮决胜负。

**双 AI provider（代码已实现）**：单机模式入口选完难度后弹「选择 AI 画家」页（`PROVIDER_LEVELS`），选 `qwen`（通义千问 `qwen3.7-flash`，OpenAI 兼容端点）或 `minimax`（MiniMax `MiniMax-M3`，Anthropic 协议端点）。provider 从前端 `web → server → ai-service` 全链路透传（body 加 `provider` 字段）。

#### 我画AI猜（`user_draws`，代码已实现）

- Web：Canvas 绘画 + 工具栏 → `AIService.recognize`（`POST /api/singleplayer/recognize`）
- Server：`SinglePlayerService.recognize()` HTTP 转发到 ai-service（105s 超时）
- ai-service：`POST /api/v1/ai/recognize` → `minimax_service.recognize_drawing(image, provider)` → 按 provider 走 OpenAI（千问）或 Anthropic（MiniMax）多模态识别
- Canvas PNG 自动转 JPEG，三层回退解析 Top-3 猜测

#### AI画我猜（`ai_draws`，代码已实现）

- Web：`game.tsx` 检测 ai_draws 回合 → `generateAiDrawing()` → `Canvas.loadStrokes(strokes, {animate:true})` 动画回放 → 启用猜词输入
- Server：`SinglePlayerService.generateDrawing()` 转发到 ai-service（105s 超时）
- ai-service：`POST /api/v1/ai/generate-drawing` → `draw_service.generate_drawing()` **两步生成**：
  1. 先按 `DRAW_PROMPT_TEMPLATE` 让模型生成绘画提示词（提炼 3 个最鲜明视觉特征 → 主体/动作/线条风格/纯白背景）
  2. 再据提示词输出笔画 JSON（`max_tokens=8192`）
- 笔画数按难度区分（easy 5-10 / medium 8-15 / hard 12-25 笔），每笔 5-30 点、带颜色层次
- 模型失败/超时走 `_fallback_strokes` 兜底几何图形，链路不断（需配 key 后实测效果）

#### 多次猜测交互（AI 画回合）

- `MAX_GUESSES = 3`（`useSinglePlayer.ts`）
- 猜错：记录到 `SinglePlayerRound.userGuesses`、显示历史猜测（最近 3 条）、给字数+首字线索、剩余次数递减、继续猜
- 猜对：绿色闪烁动画 → 结算；用完 3 次 → 结算（AI 加分，显示答案）
- 轮次切换有过渡动画

### 联机模式（代码存在，本分支未回归验证）

WebSocket 房间系统：创建/加入/离开房间、6 位邀请码、画布实时同步、猜词（含 close/length_match/wrong 近似反馈）、60s 回合计时、回合管理、断线重连覆盖层、观战模式、画者切换、房主迁移。

**WebSocket 认证（已修复）**：`handleConnection` 中内联 JWT 验证（不再依赖 WsAuthGuard），`getUserId`/`getNickname` 优先使用 JWT 验证结果，回退到 `handshake.auth`（游客模式）。`ws-auth.guard.ts` 保留为可选工具类。

### 用户管理模块（已实现并端到端验证 ✅）

**UserRecord 数据结构**（`auth.types.ts`）：

```
id / username / email? / avatar? / passwordHash / createdAt / updatedAt /
stats: { gamesPlayed, gamesWon, totalScore, currentStreak }
```

`PublicUserProfile = Omit<UserRecord, 'passwordHash'>`

**REST API 端点（全部已验证通过）**：

| 方法     | 路径                                      | 认证 | 功能                                     |
| -------- | ----------------------------------------- | ---- | ---------------------------------------- |
| `POST`   | `/api/v1/auth/register`                   | 公开 | 注册（username + password + 可选 email） |
| `POST`   | `/api/v1/auth/login`                      | 公开 | 登录，返回 JWT                           |
| `GET`    | `/api/v1/auth/me`                         | JWT  | 获取当前用户资料（含 stats）             |
| `PATCH`  | `/api/v1/auth/me`                         | JWT  | 更新资料（username / email / avatar）    |
| `POST`   | `/api/v1/auth/me/change-password`         | JWT  | 修改密码（需验证当前密码）               |
| `DELETE` | `/api/v1/auth/me`                         | JWT  | 注销账号（需验证密码）                   |
| `GET`    | `/api/v1/auth/profile/:id`                | 公开 | 按 ID 查询用户公开资料                   |
| `GET`    | `/api/v1/auth/profile/username/:username` | 公开 | 按用户名查询用户公开资料                 |

**AuthService 方法**：`register` / `login` / `validateUser` / `getUserById` / `getUserByUsername` / `updateProfile` / `changePassword` / `deleteAccount` / `updateStats` / `generateToken` / `getAllUsers` / `getUserCount`。内存 Map 存储 + `usernameIndex` 索引。

**JWT 配置集中化**：`apps/server/src/config/app.config.ts` 统一管理 `jwt.secret`、`jwt.expiresInSeconds`、`server.port`、`aiService.url`。`auth.module.ts` 的 `signOptions.expiresIn` 使用数字类型（`expiresInSeconds`），不使用字符串。

**前端实现**：

- `ProfilePage`（`apps/web/src/pages/profile/index.tsx`）：用户资料展示与编辑、游戏统计卡片
- `SettingsPage`（`apps/web/src/pages/settings/index.tsx`）：修改密码、退出登录、注销账号
- `useAuth` hook（`apps/web/src/hooks/useAuth.ts`）：`login` / `register` / `logout` / `updateProfile` / `changePassword` / `deleteAccount` / `refreshUser`
- `AuthService` 前端服务（`apps/web/src/services/auth.service.ts`）：Token 管理（localStorage）、所有认证 API 调用
- 首页用户栏：已登录显示头像/设置/退出按钮，未登录显示登录/注册按钮

**共享类型对齐**（`packages/shared/src/types/user.ts`）：新增 `UserStats` / `UpdateProfileRequest` / `ChangePasswordRequest` / `AuthResponse`，与后端 `UserRecord` / `PublicUserProfile` 字段一致。

### 排行榜（代码存在，本分支未回归验证）

周期切换（weekly/monthly/all）、Top-3 奖牌、当前用户高亮、空状态。内存 Map 存储。来自 `dev-pqx` 遗留实现，本次会话未验证。

### ✅ Canvas 组件（packages/ui）

自由绘画、撤销/重做（最多 50 步，Ctrl+Z / Ctrl+Y 快捷键）、导出 base64 PNG、`loadStrokes()` 动画回放、橡皮/画笔切换。**容器 2px 黑边 + 圆角 8px + maxWidth 560 居中**（边框放容器避免残缺）。

---

## 4. 已知问题 / 待完善

按严重度排序：

1. **ai_draws 猜词仅客户端校验**：`submitGuess` 本地精确匹配 `text.trim() === targetWord`，无后端调用、无模糊匹配，与 user_draws 调 `/recognize` 不对称。
2. **计分规则与 spec 不一致**：Web 端当前为每轮 +1 的简化计分，spec 003 US5 要求 10 分制 + 时间/置信度奖励（server 有 `calculateScore` 未被 Web 使用）。
3. **猜词超时未结算**：ai_draws 回合倒计时归零后停在 guessing 状态，未自动结算（AI 加分）。
4. **词库无类别**：`words.json` 只有难度分组，无名词/动词类别，提示按钮目前只显示字数+首字。
5. **`round_ended` 的 endReason 硬编码**：客户端无法可靠区分超时 vs 全部猜中。
6. **排行榜 `cleanup()` 从未被调度**，陈旧数据无限累积；`avatarUrl` 永远 undefined。
7. **误提交构建缓存**：`apps/miniprogram/.swc/plugins/.../a824c086149a...`（2.6 MB 二进制）不应入版本控制。
8. **ai-service 的 `package.json` lint/typecheck 是 `echo` 桩脚本**，不真跑 ruff/mypy；无测试目录。
9. **API key 已从仓库清除**：`apps/ai-service/.env` 不在版本控制中，运行前需自行填入（见第 5 节）。
10. **共享常量是死代码**：`packages/shared/src/constants/api.ts` 的 `API_ROUTES`/`WS_EVENTS` 已定义但各 app 都硬编码路径，未导入。
11. **JWT_SECRET 回退硬编码**：`'draw-guess-ai-dev-secret-key-2026-change-in-production'`（仅开发兜底）。
12. **用户数据无持久化**：内存 Map 存储，重启即丢；`stats` 字段已定义但游戏结束时尚未调用 `updateStats` 更新。
13. **前端 useAuth/useAuthService 内联类型**：`useAuth.ts` 和 `auth.service.ts` 中 `User` 接口是内联定义，未复用 `@draw-guess/shared` 的共享类型（功能正常但类型不一致）。

---

## 5. AI 服务配置（关键）

⚠️ **仓库里无 `.env` 文件**（仅 `.env.example`），运行前需创建并填入密钥：

```bash
# apps/ai-service/.env
# MiniMax 官方端点（sk-api-* 格式密钥，同时用于两个端点）
MINIMAX_API_KEY=sk-api-xxxxxxx
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
MINIMAX_MODEL=MiniMax-M3

# Anthropic 兼容端点（provider=minimax 走此通道，同一密钥）
MINIMAX_ANTHROPIC_API_KEY=sk-api-xxxxxxx
MINIMAX_ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
MINIMAX_ANTHROPIC_MODEL=MiniMax-M3
```

亦可配置为千问（火山方舟 OpenAI 兼容端点）：

```bash
MINIMAX_API_KEY=<你的火山方舟 API key>
MINIMAX_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3
MINIMAX_MODEL=minimax-m3
```

- 双 provider 由请求体 `provider` 字段选择（`qwen` 走 OpenAI 兼容 `/chat/completions` + `Authorization: Bearer`；`minimax` 走 Anthropic `/v1/messages` + `x-api-key` + `anthropic-version`）。
- 识别/绘画服务都按 provider 分支构造请求与解析响应（`_extract_text` 处理两种响应格式）。
- 缺 key 时分别抛 `MiniMaxError` / `DrawError` → 路由返回 503 `AI_SERVICE_UNAVAILABLE`。
- 超时：ai-service 识别 90s、绘画两步各 30s+60s（`asyncio.wait_for` 总超时）；server 转发 105s；绘画失败走兜底简笔画。
- 依赖：`httpx` + `python-dotenv` + `Pillow`（PNG→JPEG 转码）。

Server 侧：`apps/server/.env` 需配 `AI_SERVICE_URL=http://localhost:8000`。

---

## 6. 关键文件速查

| 功能                            | 路径                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| **交接文档（本文件）**          | `HANDOVER.md`                                                                          |
| 开发指南                        | `DEV_GUIDE.md`                                                                         |
| Web 入口/路由                   | `apps/web/src/main.tsx`                                                                |
| 单机模式 hook                   | `apps/web/src/hooks/useSinglePlayer.ts`                                                |
| 单机模式页面                    | `apps/web/src/pages/singleplayer/index.tsx` + `game.tsx`                               |
| Web AI 服务客户端               | `apps/web/src/services/ai.service.ts`                                                  |
| Web 认证服务                    | `apps/web/src/services/auth.service.ts`                                                |
| Web 认证 Hook                   | `apps/web/src/hooks/useAuth.ts`                                                        |
| 用户资料页                      | `apps/web/src/pages/profile/index.tsx`                                                 |
| 设置页                          | `apps/web/src/pages/settings/index.tsx`                                                |
| Server 入口                     | `apps/server/src/main.ts`                                                              |
| Server 模块注册                 | `apps/server/src/app.module.ts`                                                        |
| **Server 配置中心**             | `apps/server/src/config/app.config.ts`                                                 |
| 单机 controller                 | `apps/server/src/modules/singleplayer/singleplayer.controller.ts`                      |
| 单机 service（转发 ai-service） | `apps/server/src/modules/singleplayer/singleplayer.service.ts`                         |
| WebSocket 网关                  | `apps/server/src/gateway/room.gateway.ts`                                              |
| WebSocket 认证守卫（可选）      | `apps/server/src/gateway/ws-auth.guard.ts`                                             |
| 游戏引擎                        | `apps/server/src/gateway/game-engine.service.ts`                                       |
| 认证模块                        | `apps/server/src/modules/auth/`                                                        |
| 认证类型定义                    | `apps/server/src/modules/auth/auth.types.ts`                                           |
| 认证服务                        | `apps/server/src/modules/auth/auth.service.ts`                                         |
| 认证控制器                      | `apps/server/src/modules/auth/auth.controller.ts`                                      |
| JWT 策略                        | `apps/server/src/modules/auth/strategies/jwt.strategy.ts`                              |
| JWT Guard                       | `apps/server/src/modules/auth/guards/jwt-auth.guard.ts`                                |
| 排行榜模块                      | `apps/server/src/modules/leaderboard/`                                                 |
| 词库服务                        | `apps/server/src/gateway/word.service.ts`                                              |
| AI 服务入口                     | `apps/ai-service/src/main.py`                                                          |
| AI 服务路由                     | `apps/ai-service/src/routers/ai.py`                                                    |
| 识别服务（minimax-m3）          | `apps/ai-service/src/services/minimax_service.py`                                      |
| 绘画服务（笔画生成）            | `apps/ai-service/src/services/draw_service.py`                                         |
| AI 服务配置                     | `apps/ai-service/src/config.py`                                                        |
| AI 服务依赖                     | `apps/ai-service/pyproject.toml`                                                       |
| 共享类型                        | `packages/shared/src/types/`                                                           |
| 共享用户类型                    | `packages/shared/src/types/user.ts`                                                    |
| 共享常量                        | `packages/shared/src/constants/`                                                       |
| 共享入口                        | `packages/shared/src/index.ts`                                                         |
| Canvas 组件                     | `packages/ui/src/components/Canvas/`（Canvas.tsx / .hooks.ts / .utils.ts / .types.ts） |
| ESLint 配置                     | `eslint.config.mjs`                                                                    |
| Turbo 配置                      | `turbo.json`                                                                           |
| CI 配置                         | `.github/workflows/ci.yml`                                                             |
| Commit 规范                     | `commitlint.config.mjs`                                                                |

---

## 7. 数据流

### 单机模式

```
Web (useSinglePlayer / AIService，body 含 provider)
  → POST /api/singleplayer/{recognize|generate-drawing}
  → vite proxy 重写 /api → /api/v1
  → POST /api/v1/singleplayer/*  (NestJS controller)
  → SinglePlayerService.recognize()/generateDrawing()  (HTTP 调 ai-service)
  → ai-service /api/v1/ai/{recognize|generate-drawing}
  → 按 provider 调模型：qwen（OpenAI 兼容）/ minimax（Anthropic 协议）
  → 返回 AIRecognizeResponse / AIDrawResponse
```

### 用户管理

```
Web (useAuth hook / AuthService)
  → POST /api/auth/{register|login}        → 注册/登录，返回 JWT
  → GET /api/auth/me (Bearer token)       → 获取当前用户
  → PATCH /api/auth/me (Bearer token)     → 更新资料
  → POST /api/auth/me/change-password     → 改密
  → DELETE /api/auth/me                    → 注销
  → GET /api/auth/profile/:id             → 公开查询
  → vite proxy 重写 /api → /api/v1
  → NestJS AuthController → AuthService
```

### WebSocket 认证

```
Client (Socket.IO) → handshake.auth.token = JWT
  → RoomGateway.handleConnection()
  → extractToken(client) → jwtService.verify(token)
  → client.userId = payload.sub, client.username = payload.username
  → getUserId()/getNickname() 优先使用 JWT 验证结果
  → 回退到 handshake.auth（游客模式）
```

> Web 端请求 `/api/singleplayer/*`，由 vite proxy 重写为 `/api/v1/singleplayer/*`（server globalPrefix `/api/v1`）。dev 已匹配；**生产部署需在网关配同等重写**。

---

## 8. 代码规范

- **ESLint** flat config，启用 `consistent-type-imports`（仅用于类型的导入写 `import type`）。**server 例外**：`apps/server/src/**/*.ts` 关闭该规则（NestJS DI 依赖 `emitDecoratorMetadata`，构造函数注入的 provider 必须值导入）。
- **Prettier**：单引号 | 分号 | 120 字宽 | 尾逗号 all | 2 空格 | LF。
- **Commit**（Conventional Commits）：`<type>(<scope>): <subject>`，type 限 `feat|fix|docs|style|refactor|test|chore|spec|perf|ci|build|revert`，scope 限 `web|miniprogram|server|ai-service|shared|design|test|spec|repo`。
- **Git hooks**：pre-commit 跑 `lint-staged`，commit-msg 跑 `commitlint`。
- **CI**（GitHub Actions）：PR/push 到 `main`/`develop` 跑 lint → typecheck → build。
- **开发流程**：Spec-First（`specs/NNN-xxx/spec.md` → plan → tasks → implement），禁止跳过规范直接编码。

---

## 9. Specs 状态

| #   | 名称                  | 状态                                                                        |
| --- | --------------------- | --------------------------------------------------------------------------- |
| 001 | Monorepo 脚手架       | 已完成                                                                      |
| 002 | WebSocket 房间系统    | 代码存在（dev-pqx 遗留），本分支未验证                                      |
| 003 | 单机画布与 AI 对战    | 本分支重点：双 provider + 两步 AI 画 + 多次猜测已实现；计分/降级/测试待完善 |
| 004 | 联机画布同步 + 排行榜 | 代码存在（dev-pqx 遗留），本分支未验证                                      |
| 005 | 用户系统              | **已实现并验证**：注册/登录/JWT + 资料编辑/改密/注销/公开查询 + WS 认证修复 |

---

## 10. 未实现 / 未开始

- **故事模式**：仅首页禁用占位按钮；`API_ROUTES.AI.GENERATE_STORY`/`EVALUATE_DRAWING` 常量存在但 ai-service 无端点。
- **数据库持久化**：用户/房间/排行榜全内存 Map，重启即丢。
- **小程序端功能**：仅脚手架。
- 游客登录 REST 端点、ai_draws 后端猜词校验、全局错误边界、ai-service 鉴权与测试。
- 用户 `stats` 统计字段已定义但游戏结束时尚未调用 `updateStats` 更新。

---

## 11. 与 DEV_GUIDE 的差异（以本文档为准）

`DEV_GUIDE.md` 描述 `main` 分支，`dev-xj` 与之差异：

| 项                 | DEV_GUIDE（main）        | dev-xj 实际                                                                                   |
| ------------------ | ------------------------ | --------------------------------------------------------------------------------------------- |
| 单机 AI provider   | mock（随机/成功率）      | 双 provider：qwen（千问 flash）/ minimax（MiniMax-M3），可切换                                |
| 模型选择           | 无                       | 单机入口「选择 AI 画家」页（`PROVIDER_LEVELS`）                                               |
| ai-service         | 仅 `/health`、`/info` 桩 | 完整 recognize + generate-drawing（按 provider 分支）                                         |
| AI画我猜流程       | 文档称"未实现"           | 两步生成（绘画提示词 → 笔画），代码已实现                                                     |
| 猜词交互           | 猜一次即结算             | 最多 3 次（`MAX_GUESSES`），记录历史+线索                                                     |
| 计分               | spec 的 10 分制          | 简化为每轮 +1 `calculateRoundScore`                                                           |
| API key            | 无说明                   | 仓库已清除，需自配 `.env`                                                                     |
| **用户系统**       | 仅注册/登录/JWT          | **完整用户管理**：资料编辑/改密/注销/公开查询，JWT 配置集中化（`app.config.ts`），WS 认证修复 |
| **WebSocket 认证** | WsAuthGuard 未挂载       | 内联 JWT 验证到 `handleConnection`，`getUserId`/`getNickname` 优先 JWT                        |
| **共享类型**       | `User` 无 stats          | 新增 `UserStats` / `UpdateProfileRequest` / `ChangePasswordRequest` / `AuthResponse`          |
| **Python 环境**    | 需系统 Python 3.11+      | 可用 uv 无 root 安装 Python 3.11                                                              |

---

## 12. 本次会话变更记录

### 用户管理模块（Phase 1-4 + 修复）

**后端**：

- `auth.types.ts`：扩展 `UserRecord`（+email/avatar/updatedAt/stats），新增 `PublicUserProfile`
- `auth.service.ts`：新增 `updateProfile`/`changePassword`/`deleteAccount`/`getUserByUsername`/`updateStats`/`getAllUsers`/`getUserCount`/`generateToken`
- `auth.controller.ts`：新增 `PATCH /me`、`POST /me/change-password`、`DELETE /me`、`GET /profile/:id`、`GET /profile/username/:username`

**配置与安全**：

- `config/app.config.ts`（新建）：集中管理 JWT/Server/AI Service 配置
- `auth.module.ts`：使用 `appConfig`，`expiresIn` 改为数字类型
- `jwt.strategy.ts`：使用 `appConfig`
- `room.gateway.ts`：内联 JWT 验证（`handleConnection` + `extractToken`），`getUserId`/`getNickname` 优先 JWT
- `ws-auth.guard.ts`：标注为可选工具类

**前端**：

- `pages/profile/index.tsx`（新建）：用户资料展示/编辑 + 统计卡片
- `pages/settings/index.tsx`（新建）：改密 + 注销 + 退出
- `pages/user/index.ts`（新建）：页面导出
- `services/auth.service.ts`：新增 `updateProfile`/`changePassword`/`deleteAccount`/`getUserById`/`getUserByUsername`
- `hooks/useAuth.ts`：新增 `updateProfile`/`changePassword`/`deleteAccount`/`refreshUser`
- `main.tsx`：集成 ProfilePage/SettingsPage，首页用户栏

**共享类型**：

- `packages/shared/src/types/user.ts`：新增 `UserStats`/`UpdateProfileRequest`/`ChangePasswordRequest`/`AuthResponse`

**环境修复**：

- `package.json`：bcrypt 加入 `approvedBuilds`
- 用 uv 安装 Python 3.11.15 + 创建 `.venv` + 安装依赖
- MiniMax API key 配置到 `apps/ai-service/.env`

**端到端验证**：所有 8 个 API 端点 + Vite 代理 + 前后端联动全部通过。

---

**最后更新**：基于 `dev-xj` 分支，用户管理模块实现完成 + 环境修复 + 三服务全部启动验证通过。
