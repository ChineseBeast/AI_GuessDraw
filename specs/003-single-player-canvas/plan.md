# Implementation Plan: 单机模式 — 画布与 AI 对战

**Branch**: `003-single-player-canvas` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-single-player-canvas/spec.md`

---

## Summary

为"你画我猜AI"交付单机模式（1v1 AI 对战）的完整前端体验。核心交付：功能完整的 HTML5 Canvas 画布组件（画笔/橡皮/撤销/重做/清空）、单机对战流程（5 轮回合制）、AI 识别集成（mock-first 策略）、计分系统、结果结算页面。

**关键决策**：画布组件设计为共享 UI 组件（`packages/ui/`），可供后续联机模式和故事模式复用。AI 识别先用 mock 实现，真实 AI 集成留待 AI Service Feature 完成后再接入。

---

## Technical Context

**Language/Version**: TypeScript 5.6+, React 18+

**Primary Dependencies**: React 18, Vite 5, HTML5 Canvas API (原生), socket.io-client (复用)

**Storage**: 前端内存状态（React useState + useReducer），无持久化需求（V1）

**Testing**: Vitest (组件单元测试), React Testing Library (画布交互测试)

**Target Platform**: Web browser (Chrome 90+, Safari 14+, Firefox 88+, Edge 90+)

**Project Type**: Web 前端 SPA（React + Vite）

**Performance Goals**: 画布 60fps, 首屏 < 2s, 撤销/重做 < 50ms

**Constraints**: 无后端依赖（AI 识别 mock 模式），纯前端可独立运行和演示

**Scale/Scope**: 单人使用，无并发压力

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| 原则 | 状态 | 说明 |
|------|------|------|
| I. Spec-First | ✅ | spec.md → plan.md → tasks.md → implement |
| II. 用户价值优先 | ✅ | 6 个用户故事按 P0-P1 优先级，US1-US3 为 MVP |
| III. 跨平台一致性 | ✅ | 画布组件封装为共享组件，shared 包复用 BrushConfig/Point 等类型 |
| IV. AI 服务质量 | ⚠️ Mock | AI 识别先用 mock 实现，后续接入真实 AI Service |
| V. 实时通信可靠性 | ⚠️ N/A | 单机模式不涉及 WebSocket |

---

## Project Structure

### Documentation (this feature)

```text
specs/003-single-player-canvas/
├── plan.md              # This file
├── research.md          # 技术决策记录
├── data-model.md        # 数据模型
├── contracts/           # API 契约
│   └── ai-recognition-api.md
├── quickstart.md        # 快速启动指南
└── tasks.md             # 任务分解
```

### Source Code

```text
packages/ui/                        # 🆕 共享 UI 组件库
├── src/
│   ├── components/
│   │   └── Canvas/
│   │       ├── Canvas.tsx          # 核心画布组件
│   │       ├── Canvas.types.ts     # 画布组件 Props/State 类型
│   │       ├── Canvas.hooks.ts     # 画布交互 hooks（useCanvas, useDrawing, useHistory）
│   │       ├── Canvas.utils.ts     # 画布工具函数（坐标转换、笔画渲染）
│   │       ├── Canvas.styles.ts    # 画布样式常量
│   │       └── index.ts            # barrel export
│   └── index.ts                    # packages/ui barrel export
├── package.json
└── tsconfig.json

apps/web/src/                       # Web 应用（扩展）
├── pages/
│   └── singleplayer/               # 🆕 单机模式页面
│       ├── index.tsx               # 单机模式入口（路由页）
│       ├── game.tsx                # 对战主页面（画布 + 信息栏 + 计时器）
│       ├── result.tsx              # 结算页面（总分 + 回合回顾）
│       ├── components/
│       │   ├── Toolbar.tsx         # 工具栏（颜色/笔触/工具切换）
│       │   ├── Timer.tsx           # 倒计时组件
│       │   ├── GuessInput.tsx      # 猜词输入组件
│       │   ├── ScoreBoard.tsx      # 计分板
│       │   └── RoundReview.tsx     # 回合回顾组件
│       └── index.ts
├── hooks/
│   ├── useSinglePlayer.ts          # 🆕 单机模式状态管理 hook
│   └── useCanvas.ts                # 🆕 画布 hook（基于 packages/ui/Canvas）
├── services/
│   └── ai.service.ts               # 🆕 AI 识别 API 客户端（含 mock）
└── main.tsx                        # 扩展：添加路由

apps/server/src/                    # 后端（扩展）
├── modules/
│   └── singleplayer/               # 🆕 单机模式模块
│       ├── singleplayer.controller.ts  # REST API: POST /api/singleplayer/recognize
│       ├── singleplayer.service.ts     # 单机逻辑：出题、校验、计分
│       └── singleplayer.module.ts
└── app.module.ts                   # 扩展：注册 SinglePlayerModule

packages/shared/src/                # 共享包（扩展）
├── types/
│   └── singleplayer.ts             # 🆕 单机模式类型定义
└── constants/
    └── singleplayer.ts             # 🆕 单机模式常量
```

---

## Data Model

### Core Entities

```typescript
// 单机游戏会话
interface SinglePlayerGame {
  id: string;
  status: 'idle' | 'drawing' | 'ai_recognizing' | 'guessing' | 'round_end' | 'game_end';
  currentRound: number;
  totalRounds: number;          // 固定 5 轮
  difficulty: Difficulty;
  rounds: SinglePlayerRound[];
  userScore: number;
  aiScore: number;
  startedAt: Date;
}

// 单轮信息
interface SinglePlayerRound {
  roundNumber: number;
  role: 'user_draws' | 'ai_draws';  // 当前轮谁画
  targetWord: string;               // 目标词
  // 用户画 AI 猜
  userDrawing?: string;             // 画布 Base64
  aiGuesses?: AIGuess[];            // AI 猜测结果
  userRoundScore?: number;
  // AI 画 用户猜
  userGuesses?: string[];           // 用户猜测历史
  userGuessedCorrectly?: boolean;
  aiRoundScore?: number;
  timeRemaining?: number;
}

// AI 猜测结果
interface AIGuess {
  word: string;
  confidence: number;   // 0-1
}

// AI 识别请求
interface AIRecognizeRequest {
  image: string;        // Base64 PNG
  targetWord: string;   // 目标词（用于判定）
  difficulty: Difficulty;
}

// AI 识别响应
interface AIRecognizeResponse {
  guesses: AIGuess[];
  isCorrect: boolean;
  matchedGuess?: AIGuess;
}

// 计分明细
interface ScoreBreakdown {
  baseScore: number;          // 10
  timeBonus: number;          // max 5
  confidenceBonus: number;    // max 5
  total: number;
}
```

### State Machine

```
idle → drawing → ai_recognizing → (round_end → drawing | game_end)
                                              ↓
                                          guessing → round_end → (drawing | game_end)
```

---

## API Contracts

### REST API: AI Recognition (Mock)

```
POST /api/singleplayer/recognize
Content-Type: application/json

Request:
{
  "image": "data:image/png;base64,...",
  "targetWord": "苹果",
  "difficulty": "easy"
}

Response (200):
{
  "guesses": [
    { "word": "苹果", "confidence": 0.92 },
    { "word": "水果", "confidence": 0.78 },
    { "word": "番茄", "confidence": 0.45 }
  ],
  "isCorrect": true,
  "matchedGuess": { "word": "苹果", "confidence": 0.92 }
}
```

### Mock Strategy

- 基于目标词长度和难度模拟识别准确率：easy 80% / medium 60% / hard 40%
- 若 mock 判定"猜对"，Top-1 返回目标词 + 高置信度
- 若 mock 判定"猜错"，返回相似词 + 低置信度
- 响应延迟模拟：200-800ms 随机

---

## Component Tree

```
SinglePlayerPage
├── GamePage (game.tsx)
│   ├── Timer                    # 倒计时（60s → 0）
│   ├── Canvas (from @draw-guess/ui)  # 核心画布
│   │   └── Toolbar              # 颜色/笔触/工具
│   ├── InfoBar                  # 轮次信息 + 角色提示
│   ├── AIResultPanel            # AI 识别结果展示
│   └── GuessInput               # 猜词输入（AI 回合）
└── ResultPage (result.tsx)
    ├── FinalScore               # 总比分
    ├── RoundReviewList          # 回合回顾列表
    └── ActionButtons            # 再来一局 / 返回首页
```

---

## Technical Decisions (Key)

| 决策 | 选择 | 理由 |
|------|------|------|
| 画布技术 | HTML5 Canvas (原生) | 性能最优，无需额外依赖，60fps 目标可达 |
| 画布组件位置 | `packages/ui/` 共享包 | 联机/故事模式复用同一画布组件 |
| 状态管理 | React useState + useReducer | 单机模式状态简单，无需 Redux/Zustand |
| AI 集成策略 | Mock-first → 真实 API 切换 | 前后端解耦，前端可独立开发演示 |
| 路由方案 | React Router v6 | 需要 /singleplayer, /singleplayer/result 两个路由 |
| 画布撤销实现 | 操作栈（strokes 数组 + undoneStrokes 数组） | 复用 shared 包已有 CanvasState 类型 |
| 笔画渲染 | 路径点插值 + quadraticCurveTo | 平滑笔触，复用 Douglas-Peucker 简化 |
| 测试策略 | Vitest + React Testing Library | Vite 生态原生支持，与项目一致 |
| 样式方案 | CSS Modules | 轻量，无需额外依赖，Vite 原生支持 |

---

## Testing Strategy

| 层级 | 工具 | 覆盖目标 |
|------|------|----------|
| 画布工具函数 | Vitest | Canvas.utils.ts 100% |
| 画布组件 | React Testing Library | Canvas 交互行为（绘制、撤销、清空） |
| 单机流程 Hook | Vitest + renderHook | useSinglePlayer 状态转换 |
| AI Service | Vitest + MSW | mock API 响应和错误处理 |
| 计分逻辑 | Vitest | 所有计分场景覆盖 |

---

## Risk Register

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Canvas 性能不达 60fps | 用户体验差 | 使用 requestAnimationFrame + 离屏 Canvas 双缓冲 |
| 画布组件跨模式复用困难 | 联机模式需要额外适配 | 组件 props 设计为可扩展接口，暴露 onStroke 回调 |
| AI 真实集成延迟过高 | 破坏 3s 承诺 | Mock 阶段预留超时和降级逻辑 |
| 移动端 Canvas 触摸兼容 | 小程序/移动端无法绘画 | 使用 pointer events（统一 mouse + touch） |
