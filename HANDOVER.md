# 📋 交接文档（HANDOVER）

> **给下一个 AI 智体：请优先阅读本文档，再读取其他任何文件。**
>
> 本文档基于 **`dev-pqx` 分支实际源码**核对而成，反映真实功能状态。
> 注意：`DEV_GUIDE.md` 描述的是 `main` 分支，内容与 `dev-pqx` 现状有出入（见末尾「与 DEV_GUIDE 的差异」），**以本文档为准**。

---

## 0. 一句话定位

`AI_GuessDraw`（AI 你画我猜）—— AI 驱动的你画我猜游戏，支持单机 / 联机 / 故事三种模式。当前分支 `dev-pqx` 仅领先 `main` 一个提交 `326be6e`，核心改动是**用真实"公司 API"（字节火山方舟 Volcano Ark 上的 `minimax-m3` 模型）替换单机模式的 mock AI**，端到端接通两条单机 AI 流程。

- 仓库：`https://github.com/ChineseBeast/AI_GuessDraw.git`
- 当前分支：`dev-pqx`（tracking `origin/dev-pqx`）
- 最新提交：`326be6e feat:公司API，AI画我猜不可用，我画AI猜可用`
- 版本：v0.3.0

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
├── DEV_GUIDE.md       # ⚠️ 描述 main 分支，与 dev-pqx 现状有出入
└── HANDOVER.md        # 本文档
```

| 包 | 端口 | 职责 |
|---|---|---|
| `apps/web` | 5173 | 单机/联机/排行榜/认证页面 |
| `apps/server` | 3000 | REST `/api/v1` + WebSocket 网关 |
| `apps/ai-service` | 8000 | `/api/v1/ai/recognize` 识别 + `/api/v1/ai/generate-drawing` 绘画 |

**包间依赖**：web → shared, ui；server → shared；ui → shared；ai-service 独立（不依赖 TS 包）。

⚠️ `packages/shared` 是 `composite: true`，`types` 指向源码 `./src/index.ts`。各消费方通过 workspace symlink 直接引用源码——**不要在消费方 tsconfig 加 `references`**（会触发 TS6305）。

---

## 2. 启动方式

```bash
# 前端 + 后端（TS 侧）
pnpm install
pnpm dev                  # turbo 并行启动所有包

# 单包
pnpm --filter @draw-guess/web dev
pnpm --filter @draw-guess/server dev

# AI 服务（Python，需先配 .env，见第 5 节）
cd apps/ai-service
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Node ≥ 22.13.0，pnpm ≥ 10.8.0。

---

## 3. 当前实现状态（基于 dev-pqx 实际源码）

### ✅ 单机模式（完整可玩，5 轮）

流程：选难度 → 画布绘画 → 提交 → AI 识别猜词 → 轮换角色（`user_draws`/`ai_draws` 按轮次奇偶交替）→ 计分结算 → 5 轮决胜负。

**两条流程的代码路径都已端到端接通**：

#### 我画AI猜（`user_draws`，运行时可用 ✅）
- Web：Canvas 绘画 + 工具栏 → `AIService.recognize`（`POST /api/singleplayer/recognize`）
- Server：`SinglePlayerService.recognize()` HTTP 转发到 ai-service（35s 超时）
- ai-service：`POST /api/v1/ai/recognize` → `minimax_service.recognize_drawing()` → minimax-m3 多模态（图片+提示，`max_tokens=1024`）
- Canvas PNG 自动转 JPEG（火山方舟端点拒绝 PNG），三层回退解析 Top-3 猜测

#### AI画我猜（`ai_draws`，代码完整但运行时频繁失败 ⚠️）
- Web：`game.tsx` 检测 ai_draws 回合 → `generateAiDrawing()` → `Canvas.loadStrokes(strokes, {animate:true})` 动画回放 → 启用猜词输入 → 客户端精确字符串匹配
- Server：`SinglePlayerService.generateDrawing()` 转发到 ai-service（60s 超时）
- ai-service：`POST /api/v1/ai/generate-drawing` → `draw_service.generate_drawing()` → minimax-m3 输出 3-15 笔笔画坐标 JSON（`max_tokens=4096`）

> **核心注意**：提交信息称"AI画我猜不可用"，但**代码层面无任何禁用/桩/功能开关**——全链路接通。失败是**运行时行为**：minimax-m3 是推理模型（先吐 `reasoning_content`），输出大型坐标 JSON 常被 `finish_reason=length` 截断 → 解析得空 → `DrawError('无法从模型输出中解析笔画')` → 503。代码里 `finish_reason='length'` 警告日志印证了这一已知失败模式。

### ✅ 联机模式（基本完整）
WebSocket 房间系统：创建/加入/离开房间、6 位邀请码、画布实时同步、猜词（含 close/length_match/wrong 近似反馈）、60s 回合计时、回合管理、断线重连覆盖层、观战模式、画者切换、房主迁移。

### ✅ 用户系统（V1，内存存储）
注册/登录（用户名+密码，bcrypt）、JWT 鉴权、游客模式、`/auth/me`。数据存内存 Map，重启即丢。

### ✅ 排行榜
周期切换（weekly/monthly/all）、Top-3 奖牌、当前用户高亮、空状态。内存 Map 存储。

### ✅ Canvas 组件（packages/ui）
自由绘画、撤销/重做（最多 50 步，Ctrl+Z / Ctrl+Y 快捷键）、导出 base64 PNG、`loadStrokes()` 动画回放、橡皮/画笔切换。

---

## 4. 已知问题 / 待完善

按严重度排序：

1. **AI画我猜运行时不可用**（核心问题）：`draw_service.py` 要求 minimax-m3 输出大型坐标 JSON，常被截断 → 503。可选修复方向：换更擅长结构化输出的模型、减小笔画数/点数、改用文生图模型、或加降级兜底。
2. **`draw_service` 正则回退脆弱**（潜在 bug）：提示词示例用 `[x,y]` 数组格式，但正则回退 `_POINT_RE` 只匹配 `{"x":..,"y":..}` 字典——`json.loads` 失败且模型用数组格式时，回退丢点，加剧 503。
3. **ai_draws 猜词仅客户端校验**：`submitGuess` 本地精确匹配 `text.trim() === targetWord`，无后端调用、无模糊匹配，与 user_draws 调 `/recognize` 不对称。
4. **WsAuthGuard 未生效**：在 AppModule 注册但未挂到 RoomGateway（无 `@UseGuards`），WS 实际为游客宽松模式，直接读 `handshake.auth` 并回退。
5. **`round_ended` 的 endReason 硬编码**：客户端无法可靠区分超时 vs 全部猜中（`game-engine.service.ts` 的 `_endReason` 参数被丢弃）。
6. **排行榜 `cleanup()` 从未被调度**，陈旧数据无限累积；`avatarUrl` 永远 undefined。
7. **误提交构建缓存**：`apps/miniprogram/.swc/plugins/.../a824c086149a...`（2.6 MB 二进制）不应入版本控制。
8. **ai-service 的 `package.json` lint/typecheck 是 `echo` 桩脚本**，不真跑 ruff/mypy；无测试目录。
9. **`DEV_GUIDE.md` 自相矛盾**：一处说"单机完整可玩，AI 识别/绘画均接入真实 minimax-m3"，另一处说"AI 绘画未实现"——后者已过时。
10. **计分规则与 spec 不一致**：Web 端当前为每轮 +1 的简化计分，spec 003 US5 要求 10 分制 + 时间/置信度奖励（server 有 `calculateScore` 未被 Web 使用）。
11. **共享常量是死代码**：`packages/shared/src/constants/api.ts` 的 `API_ROUTES`/`WS_EVENTS` 已定义但各 app 都硬编码路径，未导入。
12. **JWT_SECRET 回退硬编码**：`'draw-guess-ai-dev-secret-key-2026'`（仅开发兜底）。

---

## 5. AI 服务配置（关键）

`apps/ai-service` 只提交了 `.env.example`，**无 `.env`，无实时密钥**。运行前需自备：

```bash
# apps/ai-service/.env
MINIMAX_API_KEY=<你的火山方舟 API key>
MINIMAX_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3   # 默认值
MINIMAX_MODEL=minimax-m3                                            # 默认值
```

- "公司 API" = 字节火山方舟（Volcano Ark）OpenAI 兼容端点，服务模型 `minimax-m3`。
- 代码保留 MiniMax 命名（`MINIMAX_*`、`minimax_service.py`），但实际 provider 是火山方舟，不是 MiniMax 官方 `https://api.minimaxi.com/v1`（后者在 `.env.example` 作为替代方案记录）。
- 缺 key 时两个服务分别抛 `MiniMaxError` / `DrawError` → 路由返回 503 `AI_SERVICE_UNAVAILABLE`。
- 依赖：`httpx` + `python-dotenv` + `Pillow`（PNG→JPEG 转码）。

Server 侧：`apps/server/.env` 需配 `AI_SERVICE_URL=http://localhost:8000`。

---

## 6. 关键文件速查

| 功能 | 路径 |
|---|---|
| **交接文档（本文件）** | `HANDOVER.md` |
| Web 入口/路由 | `apps/web/src/main.tsx` |
| 单机模式 hook | `apps/web/src/hooks/useSinglePlayer.ts` |
| 单机模式页面 | `apps/web/src/pages/singleplayer/index.tsx` + `game.tsx` |
| Web AI 服务客户端 | `apps/web/src/services/ai.service.ts` |
| Server 入口 | `apps/server/src/main.ts` |
| Server 模块注册 | `apps/server/src/app.module.ts` |
| 单机 controller | `apps/server/src/modules/singleplayer/singleplayer.controller.ts` |
| 单机 service（转发 ai-service） | `apps/server/src/modules/singleplayer/singleplayer.service.ts` |
| WebSocket 网关 | `apps/server/src/gateway/room.gateway.ts` |
| 游戏引擎 | `apps/server/src/gateway/game-engine.service.ts` |
| 认证模块 | `apps/server/src/modules/auth/` |
| 排行榜模块 | `apps/server/src/modules/leaderboard/` |
| 词库服务 | `apps/server/src/gateway/word.service.ts`（或 data/words.json） |
| AI 服务入口 | `apps/ai-service/src/main.py` |
| AI 服务路由 | `apps/ai-service/src/routers/ai.py` |
| 识别服务（minimax-m3） | `apps/ai-service/src/services/minimax_service.py` |
| 绘画服务（笔画生成） | `apps/ai-service/src/services/draw_service.py` |
| AI 服务配置 | `apps/ai-service/src/config.py` |
| AI 服务依赖 | `apps/ai-service/requirements.txt` / `pyproject.toml` |
| 共享类型 | `packages/shared/src/types/` |
| 共享常量 | `packages/shared/src/constants/` |
| 共享入口 | `packages/shared/src/index.ts` |
| Canvas 组件 | `packages/ui/src/components/Canvas/`（Canvas.tsx / .hooks.ts / .utils.ts / .types.ts） |
| ESLint 配置 | `eslint.config.mjs` |
| Turbo 配置 | `turbo.json` |
| CI 配置 | `.github/workflows/ci.yml` |
| Commit 规范 | `commitlint.config.mjs` |

---

## 7. 数据流（单机模式）

```
Web (useSinglePlayer / AIService)
  → POST /api/singleplayer/{recognize|generate-drawing}
  → vite proxy 重写 /api → /api/v1
  → POST /api/v1/singleplayer/*  (NestJS controller)
  → SinglePlayerService.recognize()/generateDrawing()  (HTTP 调 ai-service)
  → ai-service /api/v1/ai/{recognize|generate-drawing}
  → 火山方舟 minimax-m3
  → 返回 AIRecognizeResponse / AIDrawResponse
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

| # | 名称 | 状态 |
|---|---|---|
| 001 | Monorepo 脚手架 | 已完成 |
| 002 | WebSocket 房间系统 | 已完成 |
| 003 | 单机画布与 AI 对战 | 基本完成（识别/绘画已接入真实 AI，待完善猜词/计分/降级/测试） |
| 004 | 联机画布同步 + 排行榜 | 已完成 |
| 005 | 用户系统 | 已完成（V1 内存存储） |

---

## 10. 未实现 / 未开始

- **故事模式**：仅首页禁用占位按钮；`API_ROUTES.AI.GENERATE_STORY`/`EVALUATE_DRAWING` 常量存在但 ai-service 无端点。
- **数据库持久化**：用户/房间/排行榜全内存 Map，重启即丢。
- **小程序端功能**：仅脚手架。
- 游客登录 REST 端点、ai_draws 后端猜词校验、设置/个人资料页、全局错误边界、ai-service 鉴权与测试。

---

## 11. 与 DEV_GUIDE 的差异（以本文档为准）

`DEV_GUIDE.md` 描述 `main` 分支，`dev-pqx` 与之差异：

| 项 | DEV_GUIDE（main） | dev-pqx 实际 |
|---|---|---|
| 单机 AI provider | mock（随机/成功率） | 真实火山方舟 minimax-m3 |
| ai-service | 仅 `/health`、`/info` 桩 | 完整 recognize + generate-drawing |
| server singleplayer | mock recognize | HTTP 转发 ai-service |
| AI画我猜流程 | 文档称"未实现" | 代码已端到端接通（运行时失败是模型输出问题） |
| 计分 | spec 的 10 分制 | 简化为每轮 +1 `calculateRoundScore` |
| NestJS | `import type {Provider}` | 值 `import {Provider}`（emitDecoratorMetadata） |
| server tsconfig | CommonJS | node16 |
| nanoid | 5.x | 3.x（Taro/CJS 兼容） |

---

**最后更新**：基于 `dev-pqx` 分支 `326be6e` 提交的源码审计。
