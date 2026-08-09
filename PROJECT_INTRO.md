# AI 你画我猜（Draw & Guess AI）项目介绍

> 一个由大模型驱动的「你画我猜」游戏:AI 既会**看画猜词**,也会**执笔作画**,还能**写故事、评画作**。
> 支持单机、联机、故事三种模式,覆盖 Web 端,后端为 NestJS + Socket.IO,AI 能力由独立 FastAPI 服务承载。

---

## 目录

1. [选题背景](#1-选题背景)
2. [功能介绍](#2-功能介绍)
3. [技术架构](#3-技术架构)
4. [AI 使用心得](#4-ai-使用心得)
5. [演示说明](#5-演示说明)

---

## 1. 选题背景

### 1.1 为什么做这个项目

「你画我猜」是人类历史上最经典的社交游戏之一:一人执笔,众人竞猜。它规则简单、上手零门槛,却天然依赖**多模态理解**——把一幅涂鸦转译成语言。恰好,这正是当前大模型最擅长的能力之一。

本项目希望回答一个问题:**当 AI 不再只是"出题人",而是真正走进牌桌,成为会画画、会猜词的"玩家",游戏会变成什么样?**

因此我们做了三件事:

1. **让 AI 当猜词者**:把你画的简笔画交给多模态大模型,由它像真人玩家一样给出候选词;
2. **让 AI 当画师**:让模型把"苹果""恐龙"这样的词,分解成一条条带坐标的笔画轨迹,在前端画布上实时回放;
3. **让 AI 当作者**:为故事模式即时生成剧情、在玩家画完后对画作打分并续写故事分支。

### 1.2 解决的问题

| 痛点 | 本项目的解法 |
| --- | --- |
| 你画我猜必须"凑够人"才能玩 | 单机模式一人即可对战 AI;联机模式房间可随时加入 AI 玩家补位 |
| 传统 AI 猜词是"题库匹配",体验僵硬 | 使用多模态大模型真正"看懂"画作,支持开放式词汇 |
| AI 参与游戏缺乏真实感 | AI 有昵称、会按 3 秒节奏"思考"、能排名计分、会被邀请进入联机房间 |
| 单人游戏内容消耗快 | 故事模式:AI 即时生成三主题三章节剧情,画作决定分支结局,重复可玩性高 |

### 1.3 目标用户

- **休闲玩家**:不需要登录即可体验单机与故事模式(游客模式);
- **AI 爱好者**:直观感受多模态模型"看图说话"与"看图作画"的能力边界;
- **教育/创意场景**:用"画出来"的方式训练表达能力,AI 评分反馈提供即时激励;
- **想快速体验联机对战的人**:创建房间、分享 6 位邀请码、房主一键开启 AI 玩家加入对局。

### 1.4 市场相关性

- **AI 游戏化**:2024 年以来,多模态模型(图像识别、文生图、视频生成)快速成熟,把 AI 能力包装成"游戏玩法"而非"聊天窗口",是 C 端产品的主流方向;
- **人机共玩**:业界已有 "AI 当队友/对手" 的玩法探索(如 AI NPC、AI 陪玩),本项目以最简单的「猜画」作为载体,验证了"AI 玩家"在实时房间游戏中的可行性与趣味性;
- **技术演示价值**:一套代码同时演示了多模态识别、结构化生成(笔画 JSON)、故事生成与图像评价,可作为 AI 应用开发的参考样例。

---

## 2. 功能介绍

### 2.1 总体功能地图

```
Draw & Guess AI
├── 单机模式（5 轮制, 无需登录）
│   ├── 我画 AI 猜: 画布绘画 → 提交 → AI 识别猜词 → 得分
│   └── AI 画我猜: AI 生成笔画 → 画布动画回放 → 用户猜词（最多 3 次）
├── 联机模式（需要登录, 房间制, WebSocket 实时同步）
│   ├── 房间管理: 创建/加入（6 位邀请码）/离开/观众/断线重连
│   ├── AI 玩家: 房主开关 allowAI, AI 可作画（笔画回放）也可猜词
│   ├── 实时画布: 笔画逐笔同步、撤销/清空同步、橡皮擦
│   ├── 猜词反馈: 对/错/接近/字数提示, 猜对排名与计分
│   └── 回合与结算: 60s/轮, 多人轮换作画, 总分排名
├── 故事模式（三主题 × 三章节, 无需登录）
│   ├── AI 生成剧情与绘画提示词（不可用时本地降级）
│   ├── 玩家画作 → AI 评分（1-3 星）+ 续写下一章
│   └── 三种分支结局（传说/希望/意外）, 由总分决定
├── 用户系统（注册/登录/JWT/游客/资料/设置）
├── 后台管理（首个注册用户自动成为 admin）
│   ├── 仪表盘统计 / 用户管理 / 房间管理 / 词库管理
└── 排行榜（周榜 / 月榜 / 总榜）
```

### 2.2 单机模式

单人即可开局,固定使用 MiniMax-M3 作为对手 AI,5 轮分胜负,难度分 `easy / medium / hard` 三档(影响出题词汇)。

**我画 AI 猜(user_draws)**

1. 系统随机出题(如「苹果」);
2. 用户在画布上作画(画笔/橡皮/撤销/清空);
3. 提交画作 → 图片以 Base64 上传 → 经 server 转发到 ai-service → 多模态模型识别,返回 Top-3 候选词与置信度;
4. 模型命中目标词即得分,进入下一轮。

**AI 画我猜(ai_draws)**

1. AI 按目标词**两步生成**笔画:先提炼 3 个视觉特征(如「苹果 → 圆形轮廓、红色、顶部叶柄」),再据此输出笔画轨迹 JSON;
2. server 将笔画按 `canvas_sync` 事件推给前端,前端在画布上**动画回放** AI 的作画过程;
3. 用户猜词,最多 3 次(`MAX_GUESSES`),猜错给出**字数 + 首字**线索,猜对触发绿色闪烁动画;
4. 轮次按奇偶在「我画 / AI 画」之间交替,5 轮后结算总分。

### 2.3 联机模式

基于 Socket.IO 的实时房间对战,支持 4-8 人(含 AI 玩家),**需要登录账号**(游客仅可玩单机与故事)。

**房间与对局流程**

```
创建房间(难度/人数/AI开关) → 邀请码分享 → 玩家加入 → 房主开始
→ 3s 倒计时 → 第 1 轮(随机决定画者顺序) → 作画 60s / 猜词
→ 全员猜对或超时 → 结算 → 下一轮 → 总轮数 = 人数 × 2 → 最终排名
```

**AI 玩家(本项目的核心亮点)**

- 房主创建房间时可勾选「允许 AI 玩家加入」,服务器会向房间注入一名固定身份 AI 玩家(`userId = 'ai_player'`,昵称「AI 小画师」);
- **AI 作画轮**:服务器调用 ai-service 生成笔画,并把每笔作为 `canvas_sync` 事件广播回放,同时广播 `ai_status`(`drawing → draw_done`),AI 作画轮时长自动延长 90 秒(60s + 90s),以覆盖模型生成耗时;
- **AI 猜词轮**:AI 每 3 秒检查一次画布(`AI_GUESS_INTERVAL_MS`),有新笔画时把笔画轨迹发给 ai-service 渲染成图片并识别,得到候选词后**精确匹配**目标词,命中即通过 `ai_guess` 事件广播并正常计分排名——与人类玩家共用同一套猜词/计分/结束判定逻辑;
- AI 猜对时房间内所有玩家都能看到「AI 小画师 猜对了」的排名广播。

**实时画布同步**

- 绘画者的每一笔(`canvas_action: draw/erase/undo/clear`)都带上服务端分配的序列号,以 `canvas_sync` 广播给所有猜词者与观众;
- 猜词端按序列号重放笔画,支持橡皮擦(白色轨迹)与撤销/清空状态还原;
- 绘画者断线后,服务器可延长回合并切换画者,避免对局卡死。

**猜词反馈与计分**

- 服务端对每个猜测给出 `exact / close / length_match / wrong` 四档反馈(编辑距离 ≤ 1 视为"接近");
- 计分规则(`SCORE_RULES.multiplayer`):第 1/2/3 个猜对者分别得 15/10/5 分,其余猜对得 1 分,画者每收到一个正确猜词 +5 分;
- 回合结束原因支持 `timeout` / `all_guessed` / `drawer_submitted`(按钮已从 UI 移除,服务端保留兼容)。

**房间其他能力**:6 位邀请码(排除易混字符)、玩家进出/掉线广播、房主转移、观众模式(`join_as_spectator`)、断线重连(`reconnect`)、一局结束后发起下一局(`accept_join_next_game`)。

### 2.4 故事模式

三个主题 × 三章节的叙事冒险:**奇幻森林 / 失重航线 / 深海灯塔**。

1. 选择主题 → ai-service 调用大模型生成故事标题、章节剧情与绘画提示词(失败时使用内置剧本兜底);
2. 玩家按章节提示在画布作画并提交;
3. ai-service 对画作评分(1-3 星)、给出反馈、识别到的关键元素,并**续写下一章的剧情**;
4. 每章得分累加,三章结束后按总分触发三种结局之一:
   - ≥ 240 分:「传说结局」
   - ≥ 180 分:「希望结局」
   - 其他:「意外结局」

### 2.5 用户系统与权限

- **注册/登录**:用户名 + 密码,bcrypt 哈希存储,JWT 鉴权;首个注册用户自动成为 `admin`;
- **游客模式**:浏览器生成游客身份(`draw_guess_guest`),可玩**单机与故事**;进入**联机模式会被拦截并要求登录**(登录后自动回到联机大厅);
- **资料与设置**:头像/邮箱/用户名修改、游戏统计(场次/胜场/总分/连胜)、修改密码、注销账号;
- **后台管理**:仪表盘统计、用户列表/删号/重置密码/角色切换、房间列表/强制关闭、词库增删改查。

### 2.6 排行榜

对局结束后可提交成绩,服务端同时维护**周榜 / 月榜 / 总榜**三套数据,按总分降序返回,支持分页。

---

## 3. 技术架构

### 3.1 Monorepo 结构(pnpm + Turborepo)

```
AI_GuessDraw/
├── apps/
│   ├── web/              # React 18 + Vite 5 + TypeScript —— Web 前端(端口 5173)
│   ├── miniprogram/      # Taro 4 + React —— 微信小程序(目前仅脚手架)
│   ├── server/           # NestJS 10 + Socket.IO 4 —— 后端 API + WS 网关(端口 3000)
│   └── ai-service/       # FastAPI + Uvicorn(Python)—— AI 识别/绘画/故事服务(端口 8000)
├── packages/
│   ├── shared/           # 跨端共享类型、常量、工具(composite: true, types 指向 src)
│   └── ui/               # 共享 UI 组件(Canvas 画布组件)
├── specs/                # Spec-First 规范文档(001-006)
├── turbo.json            # 任务编排(lint/typecheck/build/dev)
├── pnpm-workspace.yaml   # catalog 统一依赖版本
├── eslint.config.mjs     # ESLint flat config(server 豁免 consistent-type-imports)
└── tsconfig.base.json
```

依赖关系:

```
web ──→ shared, ui
server ──→ shared
ui ──→ shared
ai-service(独立 Python 服务,不依赖 TS 包,通过 HTTP 通信)
```

### 3.2 技术栈总览

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 前端 | React 18 + Vite 5 + TypeScript | useState 手动路由(未引入 react-router) |
| 实时通信 | Socket.IO 4(经 NestJS WebSocket 网关) | 房间、画布同步、猜词、AI 状态广播 |
| 后端 | NestJS 10(REST + WS) | `/api/v1` 前缀,模块化:auth/admin/leaderboard/singleplayer/story |
| AI 服务 | FastAPI + Uvicorn(Python ≥ 3.11) | 独立进程,`/api/v1/ai/*` 五个端点 |
| 大模型 | MiniMax-M3 多模态 | 图像识别 + 文本生成,OpenAI / Anthropic 双兼容端点 |
| 数据 | 内存 Map + JSON 文件持久化 | `users.json` 落盘;房间/游戏/排行榜内存存储 |
| 工程化 | pnpm workspace + Turborepo | lint / typecheck / build 全包并行 |
| CI | GitHub Actions | `pnpm install --frozen-lockfile` → lint → typecheck → build |

### 3.3 服务间调用链路

```
┌────────────┐  REST(/api/singleplayer/*)   ┌────────────┐   HTTP   ┌──────────────┐   HTTPS   ┌───────────┐
│  Web 前端   │ ────────────────────────────► │ NestJS     │ ───────► │  ai-service  │ ────────► │ MiniMax-M3 │
│ (Vite 5173) │  WebSocket(Socket.IO)        │ server 3000│          │ FastAPI 8000 │           │ (多模态)   │
└────────────┘ ◄──────────────────────────── └────────────┘ ◄─────── └──────────────┘ ◄──────── └───────────┘
      │                                                                      │
      └── vite dev proxy: /api → /api/v1(生产环境需网关同配置重写)             └── 模型不可用时返回 503,由上游降级
```

关键点:

- **Web → Server**:单机接口走 `/api/singleplayer/*`,由 Vite dev proxy 重写为 `/api/v1/singleplayer/*`(server 的 `globalPrefix` 为 `/api/v1`);
- **Server → ai-service**:`SinglePlayerService` / `AIPlayerService` / `StoryService` 通过 `fetch` 调用 ai-service 的五个端点,均带超时控制与 `AI_SERVICE_UNAVAILABLE` 错误语义;
- **ai-service → 模型**:`provider` 参数二选一——`qwen`(火山方舟 OpenAI 兼容端点)或 `minimax`(MiniMax Anthropic 协议端点),密钥全部经 `.env` 注入。

### 3.4 WebSocket 事件设计

命名空间 `/`,客户端握手携带 JWT(`auth` 字段),服务端内联校验,游客回退到 `handshake.auth` 游客身份。

**客户端 → 服务端**

| 事件 | 说明 |
| --- | --- |
| `create_room` | 创建房间(人数/难度/`allowAI`) |
| `join_room` / `leave_room` | 按 6 位邀请码加入 / 离开 |
| `start_game` | 房主开始游戏 |
| `canvas_action` | 画布操作(`draw/erase/undo/clear`) |
| `finish_drawing` | 画者提前提交画作(UI 已移除按钮,服务端保留兼容) |
| `submit_guess` | 提交猜词 |
| `join_as_spectator` | 以观众身份加入 |
| `reconnect` | 断线重连恢复房间状态 |
| `accept_join_next_game` | 同意开始下一局 |

**服务端 → 客户端**

| 事件 | 说明 |
| --- | --- |
| `room_created` / `room_joined` | 房间创建/加入结果(含玩家列表、邀请码) |
| `player_joined` / `player_left` | 玩家进出广播 |
| `player_disconnected` / `player_reconnected` | 掉线/重连广播 |
| `host_changed` | 房主转移 |
| `game_started` | 游戏开始(画者顺序、总轮数、倒计时) |
| `round_started` | 轮次开始(画者视角含目标词,猜者视角含字数提示) |
| `canvas_sync` | 画布笔画同步(带序列号) |
| `guess_result` / `correct_guess` | 猜词结果 / 猜对排名广播 |
| `round_ended` / `game_ended` | 轮次结算(含 `endReason`) / 游戏结束(最终排名) |
| `ai_status` | AI 状态(`drawing` / `draw_done` / `thinking`) |
| `ai_guess` | AI 的候选词广播(含是否命中) |
| `error` | 错误信息 |

### 3.5 数据设计

当前为 **V1 轻量存储**:内存 Map 为主,文件持久化兜底,便于零依赖开箱即用;后续可平滑迁移 SQLite/PostgreSQL。

| 数据 | 存储 | 说明 |
| --- | --- | --- |
| 用户 | 内存 Map + `apps/server/data/users.json` | 注册/统计/改资料自动落盘,重启不丢 |
| 词库 | 内置词表(文件缺失时) + 内存增删 | easy/medium/hard 三档,admin 可管理 |
| 房间/游戏 | 内存(room-manager / game-engine) | 会话级数据,随进程生命周期 |
| 排行榜 | 内存三套 Map(weekly/monthly/allTime) | 提交时同步更新 |
| 故事进度 | 内存 Map | `story_${nanoid(10)}` |

核心类型示例(`packages/shared/src/types/`):

```typescript
// 单机 AI 识别
interface AIRecognizeRequest {
  image: string;        // Base64 PNG(含 data:image/png;base64, 前缀)
  targetWord: string;
  difficulty: Difficulty; // 'easy' | 'medium' | 'hard'
  provider: Provider;     // 'qwen' | 'minimax'
}
interface AIRecognizeResponse {
  guesses: { word: string; confidence: number }[]; // Top-3 候选
  isCorrect: boolean;
  matchedGuess?: { word: string; confidence: number };
  processingTime: number;
}

// 联机回合
type RoundEndReason = 'timeout' | 'all_guessed' | 'drawer_submitted';

// AI 玩家常量(apps/server/src/services/ai-player.service.ts)
export const AI_PLAYER_ID = 'ai_player';
export const AI_PLAYER_NICKNAME = 'AI 小画师';
export const AI_GUESS_INTERVAL_MS = 3_000;
export const AI_DRAW_EXTRA_MS = 90_000;
```

### 3.6 AI 服务端点(FastAPI)

| 端点 | 功能 |
| --- | --- |
| `POST /api/v1/ai/recognize` | 单机:识别画作图片,返回 Top-3 候选并判定是否命中 |
| `POST /api/v1/ai/generate-drawing` | 单机:按目标词生成笔画轨迹(绘画行为) |
| `POST /api/v1/ai/recognize-strokes` | 联机:把画布笔画轨迹渲染成 PNG 再识别,返回原始候选词(匹配判定交给调用方) |
| `POST /api/v1/ai/generate-story` | 故事:按主题生成标题 + 3 章节剧情 |
| `POST /api/v1/ai/evaluate-drawing` | 故事:对玩家画作评分、识别元素、续写剧情 |

### 3.7 工程化与部署考量

- **开发流程**:Spec-First——每个功能先写 `specs/NNN/spec.md → plan.md → tasks.md` 再编码,当前已完成 001-006 六个规范;
- **代码规范**:ESLint flat config + Prettier(单引号/分号/120 字宽);`consistent-type-imports` 对 server **豁免**——NestJS DI 依赖 `emitDecoratorMetadata`,构造器注入的 provider 必须用值导入;
- **提交规范**:Conventional Commits + husky(pre-commit 跑 lint-staged)+ commitlint(commit-msg);
- **CI**:GitHub Actions 三阶段 `lint → typecheck → build`(build 依赖前两者),`pnpm install --frozen-lockfile` 保证锁文件一致;
- **生产部署注意事项**:
  - 三个服务需分别部署(web 静态托管 / server 进程 / ai-service 进程),`AI_SERVICE_URL` 指向 ai-service 可达地址;
  - `/api` → `/api/v1` 的路径重写需在网关(Nginx 等)配置,与 Vite dev proxy 保持一致;
  - JWT secret、MiniMax API key 等敏感配置通过环境变量注入,仓库只提交 `.env.example`。

---

## 4. AI 使用心得

### 4.1 模型选型与接入

项目选用 **MiniMax-M3 多模态模型**承载全部 AI 能力,原因:

- **一个模型干所有事**:图像识别(猜词/评画)、文本生成(故事)、结构化输出(笔画 JSON),无需拼装多个模型;
- **双协议兼容**:同时支持 OpenAI 兼容端点(火山方舟)与 Anthropic 协议端点,代码里保留了 `qwen` / `minimax` 双 provider 分支,便于切换供应商测试。

接入层统一放在 ai-service,`minimax_service.py` / `draw_service.py` / `story_service.py` 三个服务分别封装识别、绘画、故事能力,server 只做 HTTP 转发,职责清晰。

### 4.2 我画 AI 猜:图像识别

**关键实现**

- 前端 Canvas 导出 PNG Base64 → ai-service 自动用 Pillow 转 JPEG 压缩,降低传输与模型输入成本;
- 模型返回候选词列表,服务端解析 Top-3 并附置信度;解析做了**多层容错**(兼容模型偶尔输出 Markdown 代码块、多余文字等情况);
- 命中判定:`_is_match` 采用「精确相等 **或互相包含**」(如模型答「大苹果」对目标「苹果」也算命中),兼顾模型口语化输出;
- **效果经验**:对简笔画(线条画)的识别准确率明显依赖**线条清晰度与对比度**,黑色粗笔默认色比浅色细笔的识别成功率高出很多;橡皮擦涂抹后的残迹会干扰识别,联机模式因此把 erase 笔画统一映射为白色。

### 4.3 AI 画我猜:笔画轨迹生成(最有挑战的部分)

**两步生成法**是解决「模型不会画画」的核心 trick:

```
第 1 步:让模型输出绘画提示词
  目标词「苹果」 → "圆形轮廓、红色、顶部叶柄、高光"

第 2 步:让模型基于提示词输出结构化笔画 JSON
  [{ "points": [{x,y}...], "color": "#d32f2f", "width": 6 }, ...]
```

- 笔画数量按难度区分:easy 5-10 笔 / medium 8-15 笔 / hard 12-25 笔,`max_tokens=8192` 保证长笔画不截断;
- **结构化输出解析**是踩坑重灾区:模型偶尔会把 JSON 包在 Markdown 代码块里、或混入解释文字,解析器需剥离噪声再 `json.loads`,失败则回退;
- **降级兜底**:模型失败/超时时,`_fallback_strokes` 会按目标词生成一组几何图形笔画(圆/三角/星形),保证游戏链路不断,只是画风变"抽象";
- **体验还原**:生成的笔画在前端用 `loadStrokes(strokes, { animate: true })` **动画回放**,而不是一次性贴图——玩家能看到 AI "一笔一笔画出来",戏剧感强很多。

### 4.4 联机 AI 玩家:无 Socket 的"幽灵玩家"

联机模式里 AI 没有真实客户端连接,它的"存在感"完全由服务端驱动:

- **AI 作画**:复用单机的笔画生成,生成后由网关把每一笔作为 `canvas_sync` 事件广播,并伴随 `ai_status`(drawing → draw_done)状态机,前端据此显示"AI 小画师 正在作画…"的提示;
- **AI 猜词**:每 3 秒 tick 一次,画布上有新笔画才调用识别(避免空画布浪费请求),识别期间标记 `inFlight` 防止并发;返回候选词后**只做精确匹配**(`===` 目标词),与人类玩家可接受"接近"不同,AI 必须全对才得分——实测这能显著减少 AI "乱猜命中" 的挫败感;
- **过期结果丢弃**:识别耗时可能跨过轮次切换,回调里会校验 `currentRound === round && status === 'active'` 再落库广播;
- **时长补偿**:AI 作画轮自动把回合时长从 60s 延长到 150s,否则模型 30-70s 的生成时间会直接吃光倒计时;
- **一致性原则**:AI 的猜词、计分、排名、全员猜对判定全部复用 `processGuess` 同款逻辑(`processAIGuess` 仅替换正确性判定),保证 AI 与真人地位对等。

### 4.5 故事模式:生成 + 评价 + 分支

- `generate-story` 按主题生成 3 章节,`evaluate-drawing` 对画作返回 `score / stars / feedback / recognizedElements / nextNarrative / branchType`;
- 故事链路**超时 15 秒**即降级到内置剧本与本地评分(`fallbackEvaluation` 按图片体积粗评星级),保证"AI 挂了故事也能玩";
- 分支结局由三章总分触发,形成「画得好 → 剧情走向不同」的正反馈。

### 4.6 经验教训总结

| 问题 | 解法 |
| --- | --- |
| 模型输出不稳定(JSON 夹杂废话/代码块) | 剥离 Markdown、按 `{` 截取、多层容错解析,失败走兜底 |
| 模型调用耗时不可控 | 所有 HTTP 调用强制超时(识别 105s / 故事 15s),超时降级,绝不让玩家无限等待 |
| AI 服务宕机体验 | 统一 `AI_SERVICE_UNAVAILABLE`(HTTP 503)语义,前端友好提示;单机/故事均有本地兜底 |
| AI 猜词节奏 | 3s 间隔 + 空画布跳过 + inFlight 防并发,避免刷屏与费用失控 |
| AI 猜对太"玄学" | 精确匹配 + 候选词广播(`ai_guess`),玩家能看到 AI 的思考过程 |
| AI 作画太慢 | 回合时长按 AI 作画轮动态延长 + 笔画动画回放掩盖等待感 |
| 密钥安全 | 全部走环境变量,仓库只提交 `.env.example` |
| 成本控制 | 联机 AI 猜词仅在"有新笔画"时调用识别;识别图片先压缩再上传 |

---

## 5. 演示说明

### 5.1 环境要求

| 依赖 | 版本 |
| --- | --- |
| Node.js | ≥ 22.13.0 |
| pnpm | ≥ 10.8.0 |
| Python | ≥ 3.11(ai-service) |
| 网络 | 可访问 MiniMax API(需自备密钥) |

### 5.2 安装与配置

```bash
# 1. 安装 JS 依赖(仓库根目录)
pnpm install

# 2. 配置 AI 服务密钥
cd apps/ai-service
cp .env.example .env
# 编辑 .env,填入你的 MiniMax 密钥:
#   MINIMAX_API_KEY=sk-api-xxxxxxx
#   MINIMAX_BASE_URL=https://api.minimaxi.com/v1
#   MINIMAX_MODEL=MiniMax-M3
#   MINIMAX_ANTHROPIC_API_KEY=sk-api-xxxxxxx
#   MINIMAX_ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
#   MINIMAX_ANTHROPIC_MODEL=MiniMax-M3
#   (也可配置为火山方舟 OpenAI 兼容端点,见 .env.example 注释)

# 3. 配置 server 环境变量
cd ../server
cp .env.example .env   # AI_SERVICE_URL=http://localhost:8000
```

### 5.3 Python 虚拟环境(ai-service)

```bash
cd apps/ai-service
python -m venv .venv            # 或使用 uv(无需 root): uv venv --python 3.11 .venv
# Windows:
.venv\Scripts\pip install -r requirements.txt
# Linux/macOS:
.venv/bin/pip install -r requirements.txt
```

### 5.4 启动三个服务

```bash
# 终端 1:AI 服务(端口 8000)
cd apps/ai-service
.venv/bin/python src/main.py                    # Windows: .venv\Scripts\python src\main.py

# 终端 2:后端(端口 3000)
cd apps/server
pnpm --filter @draw-guess/server dev            # nest start --watch

# 终端 3:前端(端口 5173)
pnpm --filter @draw-guess/web dev
```

启动完成后访问 <http://localhost:5173>。

### 5.5 演示脚本(建议 8-10 分钟)

**第 1 步:注册与游客权限(1 分钟)**

1. 打开首页 → 点击「登录/注册」→ 注册一个新账号(第一个注册账号自动成为 admin);
2. 退出登录 → 以游客身份浏览:可见**单机**与**故事**入口;
3. 点击「联机」→ 被拦截并提示"联机模式需要登录账号"→ 跳转登录页 → 登录后自动回到联机大厅。✅ 演示权限控制。

**第 2 步:单机模式 — 我画 AI 猜(2 分钟)**

1. 进入单机 → 选择「简单」难度 → 进入「我画 AI 猜」回合;
2. 看到目标词(如「太阳」)→ 用画笔画一个圆 + 射线 → 提交;
3. 等待 AI 识别(约 3-15s)→ 展示 Top-3 候选词与命中判定、得分。✅ 演示多模态识别。

**第 3 步:单机模式 — AI 画我猜(2 分钟)**

1. 进入「AI 画我猜」回合 → 观察 AI 在画布上**逐笔动画作画**(可看到 ai_status 提示);
2. 在输入框猜词,故意猜错一次 → 观察「字数 + 首字」线索;猜对 → 绿色闪烁动画。✅ 演示笔画生成与回放。

**第 4 步:联机模式 — AI 玩家(3 分钟)**

1. 进入联机大厅 → 「创建房间」→ 勾选「允许 AI 玩家加入」→ 创建;
2. 复制 6 位邀请码,再开一个浏览器窗口(或隐身窗口)登录另一个账号加入房间;
3. 房主开始游戏:
   - AI 作画轮:观看「AI 小画师」的笔画实时同步回放;
   - AI 猜词轮:你画几笔后,观察 `ai_guess` 广播(候选词)与可能的猜对排名;
4. 中途关掉一个窗口模拟掉线 → 观察断线广播与重连恢复。✅ 演示实时同步与 AI 玩家。

**第 5 步:故事模式(2 分钟)**

1. 选择主题「奇幻森林」→ 阅读 AI 生成的章节剧情;
2. 按提示作画并提交 → 查看 AI 评分(1-3 星)、反馈与"剧情续写";
3. 完成三章 → 查看最终结局。✅ 演示生成式叙事与画作评价。

**第 6 步(可选):排行榜与后台管理**

- 在单机/联机结算后查看排行榜(周/月/总榜);
- 用 admin 账号进入后台:仪表盘统计、用户管理、房间管理、词库增删。

### 5.6 常见问题(FAQ)

| 现象 | 原因与处理 |
| --- | --- |
| 单机提交后提示 `AI_SERVICE_UNAVAILABLE` | ai-service 未启动、未配置 API key,或模型调用超时;检查终端 1 日志与 `apps/ai-service/.env` |
| 端口被占用 | 3000/5173/8000 任一被占用时,先结束旧进程再启动 |
| AI 作画很慢或画风"抽象" | 笔画生成需 30-70s,属正常;模型失败时走几何图形兜底 |
| `pnpm install` 报锁文件不一致 | 仓库使用 `pnpm-lock.yaml` 冻结安装;更新依赖后需同步锁文件 |
| 生产环境 `/api` 404 | 需要网关把 `/api` 重写为 `/api/v1`(与 Vite dev proxy 一致) |
| 联机无法进入 | 确认已登录;游客仅可玩单机与故事 |

### 5.7 常用开发命令

```bash
pnpm dev                 # 启动所有包(含 ai-service 需单独起 Python)
pnpm build               # 构建全部包
pnpm lint / pnpm typecheck   # 全包并行 lint / 类型检查
pnpm --filter @draw-guess/server dev     # 只启动后端
pnpm --filter @draw-guess/web dev        # 只启动前端
pnpm --filter @draw-guess/shared build   # 只构建 shared
```

---

## 附:项目文件速查

| 功能 | 文件 |
| --- | --- |
| Web 入口/路由 | `apps/web/src/main.tsx` |
| 单机模式 | `apps/web/src/pages/singleplayer/` + `hooks/useSinglePlayer.ts` |
| 联机模式 | `apps/web/src/pages/multiplayer/` + `hooks/useSocket.ts` + `services/socket.service.ts` |
| 故事模式 | `apps/web/src/pages/story/` + `hooks/useStory.ts` |
| 后端入口/模块 | `apps/server/src/main.ts` + `app.module.ts` |
| WebSocket 网关 | `apps/server/src/gateway/room.gateway.ts` |
| 游戏引擎 | `apps/server/src/services/game-engine.service.ts` |
| AI 玩家服务 | `apps/server/src/services/ai-player.service.ts` |
| AI 服务入口 | `apps/ai-service/src/main.py` + `routers/ai.py` |
| AI 识别/绘画/故事 | `apps/ai-service/src/services/{minimax_service,draw_service,story_service}.py` |
| 共享类型/常量 | `packages/shared/src/types/` + `constants/` |
| Canvas 组件 | `packages/ui/src/components/Canvas/` |
| 规范文档 | `specs/001-006/` |
| 开发指南 | `DEV_GUIDE.md` |
