# Technical Research: 单机模式画布与 AI 对战

**Feature**: 003-single-player-canvas | **Date**: 2026-08-02

---

## 1. Canvas 渲染方案

**Decision**: 原生 HTML5 Canvas API + React ref 封装

**Rationale**:
- 性能最优：60fps 要求必须使用原生 Canvas，无法使用 DOM-based 方案
- 无额外依赖：HTML5 Canvas 所有目标浏览器原生支持
- React 集成：通过 `useRef<HTMLCanvasElement>` 获取 Canvas 上下文，React 管理组件生命周期

**Alternatives Considered**:
- **Fabric.js**: 功能丰富但包体积大（~200KB gzipped），超出需求范围
- **Konva.js**: React 绑定好但抽象层带来性能损耗，撤销/重做需额外适配
- **SVG**: 笔画数量多时性能急剧下降，不适合连续绘画场景

---

## 2. 画布组件架构（共享包 vs 内联）

**Decision**: 将 Canvas 组件放在 `packages/ui/` 作为共享 UI 组件

**Rationale**:
- 联机模式和故事模式都需要相同的画布组件
- 遵循 Constitution III（跨平台一致性）
- 共享包便于统一维护和测试

**Implementation**: `packages/ui/src/components/Canvas/`，导出 `<Canvas>` 组件 + `useCanvas` hook

---

## 3. 笔画渲染算法

**Decision**: 路径点插值 + quadraticCurveTo 平滑笔触

**Rationale**:
- 原生 lineTo 在快速移动时产生折线效果
- quadraticCurveTo 使用中点插值法，保持平滑且计算量低
- 复用 shared 包中已有的 Point[] 数据结构

**Implementation**:
```typescript
// 对连续的点进行曲线平滑
function smoothPath(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
}
```

---

## 4. 橡皮擦实现

**Decision**: `globalCompositeOperation = 'destination-out'` 模式

**Rationale**:
- 真正的像素级擦除，而非"画白色"
- 擦除后底层内容可透出（若画布非纯白背景）
- 支持不同擦除半径

**Trade-off**: destination-out 会擦除所有图层内容，无法仅擦除特定笔画。但单机模式只有一层，无此问题。

---

## 5. 撤销/重做实现

**Decision**: 操作栈模式（strokes[] + undoneStrokes[]），每次全量重绘

**Rationale**:
- 与 shared 包 CanvasState 类型一致（已有 strokes 和 undoneStrokes 字段）
- 全量重绘在笔画数量 < 1000 时性能完全可接受（< 16ms）
- 实现简单，状态管理清晰

**Stack Limit**: 50 步（spec 要求）

**Alternative Considered**: 离屏 Canvas 快照 — 内存开销大（每步 ~1MB 图片），50 步 = 50MB，不划算。

---

## 6. AI 识别 Mock 策略

**Decision**: 后端 mock 端点 + 前端可切换真实 API

**Rationale**:
- 前后端解耦：前端不关心 AI 实现细节
- 渐进增强：mock → 真实 API 只需切换 base URL
- 可测试：mock 行为确定，便于自动化测试

**Mock Algorithm**:
```
成功率 = difficulty === 'easy' ? 0.8 : difficulty === 'medium' ? 0.6 : 0.4
if Math.random() < 成功率:
  返回 [目标词(confidence: 0.85+), 相似词1, 相似词2]
else:
  返回 [错误词1, 错误词2, 错误词3]
```

---

## 7. 计分算法

**Decision**: 三段式计分：base + timeBonus + confidenceBonus

**Rationale**:
- base（10pts）：让用户始终有获得感
- timeBonus（max 5pts）：鼓励快速绘画，制造时间压力
- confidenceBonus（max 5pts）：鼓励画得更好，让 AI 更有信心

**Formula**:
```
用户画 AI 猜 → 猜对: 10 + floor(剩余秒数 × 0.1) + floor(最高置信度 × 5)
              猜错: 1
AI 画 用户猜 → 猜对: 10 + floor(剩余秒数 × 0.1)
              猜错: 0
```

---

## 8. 状态管理

**Decision**: React useReducer（而非 Redux/Zustand）

**Rationale**:
- 单机模式状态有限（1 个游戏会话，5 个轮次，1 个画布）
- useReducer 提供可预测的状态转换（action → new state）
- 零额外依赖，包体积最小

**State Shape**:
```typescript
type SinglePlayerAction =
  | { type: 'START_GAME'; difficulty: Difficulty }
  | { type: 'SUBMIT_DRAWING'; image: string }
  | { type: 'AI_RECOGNIZED'; response: AIRecognizeResponse }
  | { type: 'SUBMIT_GUESS'; text: string }
  | { type: 'GUESS_RESULT'; isCorrect: boolean }
  | { type: 'NEXT_ROUND' }
  | { type: 'END_GAME' }
  | { type: 'TICK'; timeRemaining: number }
```

---

## 9. 测试策略

**Decision**: Vitest + React Testing Library + MSW

**Rationale**:
- Vitest 与 Vite 生态原生兼容
- React Testing Library 鼓励从用户角度测试组件
- MSW (Mock Service Worker) 拦截 API 请求，测试 AI 识别流程

**Coverage Targets**:
- 画布工具函数：100%
- 单机 Hook (useSinglePlayer)：100%
- 计分逻辑：100%
- Canvas 组件交互：核心交互路径

---

## 10. 路由设计

**Decision**: React Router v6，嵌套路由

**Rationale**:
- Vite + React 标准选择
- 单机模式需要 `/singleplayer`（游戏）和 `/singleplayer/result`（结算）两个路由
- 未来联机模式 `/multiplayer` 和故事模式 `/story` 并排

**Route Structure**:
```
/                      → 首页（模式选择）
/singleplayer          → 单机模式入口（难度选择 + 开始）
/singleplayer/game     → 对战页面
/singleplayer/result   → 结算页面
/multiplayer           → 联机大厅（已有）
/multiplayer/game      → 联机对战（已有）
```
