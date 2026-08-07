# Feature Specification: 单机模式 — 画布与 AI 对战

**Feature Branch**: `003-single-player-canvas`

**Created**: 2026-08-02

**Status**: Draft

**Input**: PRD 3.1 单机模式需求 SP-001 ~ SP-011，基于已完成的 Monorepo 脚手架（001）和 WebSocket 房间系统（002）

---

## 概述

本 Feature 交付单机模式（1v1 AI 对战）的完整流程：用户绘画 → AI 识别猜词 → 轮换角色 → 计分结算。这是「你画我猜 AI」三个核心模式中第一个完整交付的模式。

**核心差异化价值**：用户无需等待真人匹配，随时随地与 AI 对战，降低使用门槛。

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — 画布绘画 (Priority: P0) 🎯 MVP

用户进入单机模式，看到一个空白画布。用户使用画笔工具在画布上绘画，可以切换颜色、调整笔触粗细、使用橡皮擦擦除、撤销不满意的笔画、清空画布重新开始。

**Why this priority**: 画布是整个游戏最基础的用户交互界面——所有三种模式（单机/联机/故事）都依赖画布组件。画布必须首先可用。

**Independent Test**: 打开单机页面 → 在画布上画几条线 → 切换颜色继续画 → 使用橡皮擦擦除部分 → 点击撤销 → 点击清空。完全独立验证，无需 AI 服务。

**Acceptance Scenarios**:

1. **Given** 用户进入单机模式页面，**When** 页面加载完成，**Then** 系统展示一个 4:3 比例（800×600 逻辑像素）的白色画布，默认选中黑色画笔，笔触宽度为 4px。
2. **Given** 用户在画布上按住鼠标/手指拖动，**When** 拖动过程中，**Then** 系统以当前选中的颜色和笔触宽度绘制连续的线条，线条跟随光标/触摸点实时渲染。
3. **Given** 用户正在绘画，**When** 用户点击颜色面板中的红色（#FF0000），**Then** 后续绘制的线条变为红色，已绘制的线条不变。
4. **Given** 用户已绘制了若干笔画，**When** 用户点击「橡皮擦」工具并在画布上拖动，**Then** 系统擦除被拖动路径覆盖的笔画部分（而非整条笔画）。
5. **Given** 用户已绘制了若干笔画，**When** 用户点击「撤销」按钮，**Then** 系统移除最后绘制的一笔（或最后擦除操作），画布恢复到该操作之前的状态。
6. **Given** 用户撤销了一笔，**When** 用户点击「重做」按钮，**Then** 系统恢复刚才被撤销的那一笔。
7. **Given** 用户已绘制了若干笔画，**When** 用户点击「清空」按钮，**Then** 系统清除画布上所有内容，恢复到空白状态。

---

### User Story 2 — 单机对战流程 (Priority: P0) 🎯 MVP

用户完成绘画后提交，AI 在 3 秒内识别并返回猜测结果。之后 AI 出题并"画"出图像（或展示目标词），用户猜测。双方轮流进行，共 5 轮，最后结算总分。

**Why this priority**: 这是单机模式的核心玩法闭环。画布是基础设施，对战流程是真正的产品价值交付。

**Independent Test**: 模拟完整 5 轮对战：画一笔 → 提交 → 等待 AI 识别 → AI 回合 → 用户猜词 → 重复 5 轮 → 查看结算。可独立验证流程完整性。

**Acceptance Scenarios**:

1. **Given** 用户已完成绘画，**When** 用户点击「提交绘画」按钮，**Then** 系统将画布内容（Canvas ImageData）发送至 AI 识别服务，画布进入只读状态，显示"AI 识别中..."加载动画。
2. **Given** AI 识别请求已发送，**When** AI 在 3 秒内返回结果，**Then** 系统展示 AI 的前 3 个猜测（Top-3），若任一猜测与目标词匹配则判定用户回合成功，计入分数。
3. **Given** AI 识别完成且用户回合结束，**When** 进入 AI 的绘画回合，**Then** 系统展示目标词（隐藏）、一个 60 秒倒计时和一个猜词输入框，用户需要在时间内猜出 AI 展示的内容。
4. **Given** 用户在 AI 回合中提交猜测，**When** 猜测正确，**Then** 系统显示"恭喜！猜对了！"并加分，进入下一轮。
5. **Given** 用户在 AI 回合中提交猜测，**When** 猜测错误，**Then** 系统给予"接近"/"字数匹配"/"不对"等提示，用户可以继续猜。
6. **Given** 5 轮对战全部完成，**When** 最后一轮结束，**Then** 系统展示结算页面：双方总分对比、每轮详情回顾（用户画了什么、AI 猜了什么；AI 画了什么、用户猜了什么）、胜负判定。
7. **Given** 结算页面展示中，**When** 用户点击「再来一局」，**Then** 系统重置状态，开始新的 5 轮对战。
8. **Given** 结算页面展示中，**When** 用户点击「返回首页」，**Then** 系统导航回首页。

---

### User Story 3 — 计时与自动提交 (Priority: P0)

每轮有 60 秒时间限制。倒计时在画布上方显著位置显示。最后 10 秒数字变红并有视觉强调。超时自动提交。

**Why this priority**: 时间压力是游戏趣味性的核心要素。没有计时就没有紧迫感。

**Independent Test**: 进入单机模式 → 开始绘画 → 观察倒计时从 60 递减 → 验证最后 10 秒变红 → 不手动提交等超时 → 验证自动提交触发。无需 AI 服务。

**Acceptance Scenarios**:

1. **Given** 用户进入绘画回合，**When** 回合开始，**Then** 系统在画布上方显示 60 秒倒计时，每秒递减。
2. **Given** 倒计时 <= 10 秒，**When** 剩余时间少于等于 10 秒，**Then** 倒计时数字变为红色（#F44336），并伴随脉冲动画（scale 放大缩小）。
3. **Given** 倒计时到达 0 秒，**When** 用户未手动提交，**Then** 系统自动截取当前画布内容并提交至 AI 识别，无需用户确认。
4. **Given** 用户在倒计时未结束时提交，**When** 用户点击「提交绘画」，**Then** 倒计时停止，系统记录剩余秒数用于时间奖励计算。

---

### User Story 4 — AI 识别集成 (Priority: P1)

用户提交绘画后，后端 AI 服务接收画布图片，使用图像识别模型分析画面内容，返回置信度最高的 3 个猜测词及其置信度分数。

**Why this priority**: AI 识别是单机模式的核心能力——没有它就无法判定画作与目标词的匹配度。但由于画布和流程可以先以 mock 方式验证，所以优先级略低于画布和流程本身。

**Independent Test**: 准备一张已知内容的图片（如画了一只猫）→ 发送至 AI 识别 API → 验证返回的 Top-3 中包含"猫"或相关词汇 → 验证置信度分数在 0-1 之间。可独立于前端验证。

**Acceptance Scenarios**:

1. **Given** 用户提交了绘画，**When** 后端接收到画布图片（Base64 或 Buffer），**Then** 系统在 3 秒内调用 AI 识别服务并返回 Top-3 猜测词列表。
2. **Given** AI 识别返回结果，**When** 其中某个猜测词与目标词完全匹配（含同义词），**Then** 系统判定"识别成功"，用户获得基础分 + 时间奖励。
3. **Given** AI 识别返回结果，**When** 没有任何猜测词匹配目标词，**Then** 系统判定"识别失败"，用户仅获得参与分（1 分），并展示 AI 猜了什么。
4. **If** AI 识别服务超时（> 5 秒）或不可用，**Then** 系统显示"AI 服务暂时不可用，请稍后重试"，并提供「重试」按钮。同时使用降级方案：随机匹配判定（30% 概率算对）。

---

### User Story 5 — 单机计分系统 (Priority: P0)

每轮根据用户是否成功让 AI 猜对、猜对时的剩余时间、以及 AI 的置信度来计算分数。5 轮结束后统计总分。

**Why this priority**: 计分是游戏激励体系的核心，直接影响用户的重玩意愿。

**Independent Test**: 完成一轮绘画 → 验证分数计算 = 基础分（10）+ 时间奖励（剩余秒数 × 0.1，最大 5）+ 置信度奖励（置信度 × 5，最大 5）→ 完成 5 轮后验证总分正确累加。

**Acceptance Scenarios**:

1. **Given** 用户回合 AI 猜对，**When** 计分时，**Then** 用户获得 = 10（基础分）+ 剩余秒数 × 0.1（最大 5）+ AI 最高置信度 × 5（最大 5），总计 10~20 分。
2. **Given** 用户回合 AI 未猜对，**When** 计分时，**Then** 用户获得 1 分（参与分）。
3. **Given** AI 回合用户猜对，**When** 计分时，**Then** 用户获得 = 10（基础分）+ 剩余秒数 × 0.1（最大 5），总计 10~15 分。
4. **Given** AI 回合用户未猜对，**When** 计时结束，**Then** 用户不得分。
5. **Given** 5 轮全部结束，**When** 系统计算总分，**Then** 总分为 5 轮分数之和，分数高者获胜。平局时判定用户胜。

---

### User Story 6 — 画布工具完整功能 (Priority: P1)

提供完整的绘画工具箱：10 色调色板、3 档笔触粗细（细 2px / 中 4px / 粗 8px）、橡皮擦、撤销/重做（最多 50 步）、清空画布。

**Why this priority**: 基础画布（US1）已覆盖核心绘画能力，完整工具箱提供更好的绘画体验，但不阻塞核心流程。

**Independent Test**: 逐一验证每个工具：颜色切换 → 笔触粗细切换 → 橡皮擦 → 连续撤销 10 次 → 重做 5 次 → 清空。完全独立验证。

**Acceptance Scenarios**:

1. **Given** 用户看到颜色面板，**When** 面板渲染，**Then** 展示 10 种预设颜色（黑、白、红、橙、黄、绿、蓝、深蓝、紫、粉），当前选中颜色有高亮边框。
2. **Given** 用户看到笔触选择器，**When** 选择器渲染，**Then** 展示 3 档粗细选项（细/中/粗），以圆形预览展示，当前选中粗细高亮。
3. **Given** 用户进行了一系列操作（画 5 笔 → 擦除 1 处 → 画 3 笔），**When** 用户连续点击「撤销」10 次，**Then** 系统依次撤销，直到画布恢复到最初状态（总共 8 步可撤销操作），撤销按钮在第 9 次点击后变为禁用状态。
4. **Given** 用户撤销了 3 步操作，**When** 用户点击「重做」2 次，**Then** 系统恢复最近 2 步被撤销的操作，第 3 步仍保留在撤销栈中等待重做。
5. **Given** 用户选中橡皮擦，**When** 在画布上拖动，**Then** 橡皮擦以圆形区域擦除笔画（橡皮擦半径 10px），擦除操作本身也可以被撤销。

---

### Edge Cases

- **空画布提交**：用户未画任何内容点击提交 → 系统提示"你还没有画任何东西哦，确定提交吗？" 确认后正常提交。
- **极小画布**：移动端横屏或小屏设备上，画布按比例缩放至视口宽度的 90%，保持 4:3 比例。
- **快速连续撤销**：用户快速点击撤销按钮（< 50ms 间隔）→ 每步操作正确执行，不丢失状态。
- **AI 返回空结果**：AI 识别返回空数组 → 视为识别失败，显示"AI 无法识别你的画作，试试画得更具体一些？"
- **网络中断**：提交绘画时网络断开 → 显示"网络连接失败，请检查网络后重试"，画布内容保留不丢失。
- **窗口失焦**：用户切换标签页 → 倒计时继续运行（游戏公平性考虑），返回时画布状态不变。

---

## Functional Requirements

| 编号 | 需求描述（EARS） | 优先级 |
|------|-----------------|--------|
| SP-001 | **The system shall** provide an HTML5 Canvas-based drawing area with 800×600 logical pixel resolution, maintaining 4:3 aspect ratio. | P0 |
| SP-002 | **The system shall** support pen tool with configurable color (10 preset colors), brush width (2px/4px/8px), and opacity (100%). | P0 |
| SP-003 | **The system shall** support eraser tool with a circular erase area of 10px radius. | P0 |
| SP-004 | **The system shall** support undo and redo operations with a history stack of up to 50 operations. | P0 |
| SP-005 | **The system shall** support clear canvas operation that resets the canvas to blank state. | P0 |
| SP-006 | **When** the user presses mouse/touch down and moves on the canvas, **the system shall** draw continuous strokes using the current tool (pen or eraser). | P0 |
| SP-007 | **The system shall** display a 60-second countdown timer above the canvas during drawing rounds. | P0 |
| SP-008 | **When** the countdown reaches ≤ 10 seconds, **the system shall** change the timer color to red (#F44336) and apply a pulse animation. | P0 |
| SP-009 | **When** the countdown reaches 0, **the system shall** automatically submit the current canvas content for AI recognition. | P0 |
| SP-010 | **When** the user clicks "提交绘画", **the system shall** capture the canvas as a PNG image and send it to the AI recognition API. | P0 |
| SP-011 | **The system shall** display AI recognition results (top-3 guesses with confidence scores) within 3 seconds of submission. | P0 |
| SP-012 | **The system shall** alternate between "user draws / AI guesses" and "AI draws / user guesses" roles each round, for a total of 5 rounds. | P0 |
| SP-013 | **The system shall** calculate scores based on: correct guess base (10pts) + time bonus (remaining seconds × 0.1, max 5pts) + AI confidence bonus (confidence × 5, max 5pts). | P0 |
| SP-014 | **The system shall** display a final result screen after 5 rounds showing total scores, per-round details, and win/loss/draw verdict. | P0 |
| SP-015 | **If** the AI recognition service is unavailable or times out (> 5s), **the system shall** display a friendly error with retry option and fall back to random matching (30% chance of success). | P1 |
| SP-016 | **While** the player is drawing, **the system shall** not block the canvas UI — all drawing operations must render at 60fps regardless of network state. | P1 |
| SP-017 | **The system shall** allow the player to select difficulty (easy/medium/hard) before starting a single-player game, affecting the target word complexity. | P1 |
| SP-018 | **The system shall** display a "返回首页" button and a "再来一局" button on the result screen. | P0 |

---

## Success Criteria

| 编号 | 指标 | 目标值 | 测量方式 |
|------|------|--------|----------|
| SC-001 | 画布渲染帧率 | ≥ 60fps | Chrome DevTools Performance 面板 |
| SC-002 | 笔画渲染延迟 | < 16ms（单帧内） | requestAnimationFrame 时间戳 |
| SC-003 | AI 识别响应时间 (P95) | < 3 秒 | API 响应时间监控 |
| SC-004 | 首屏加载时间 | < 2 秒 | Lighthouse Performance Score |
| SC-005 | 撤销/重做操作响应 | < 50ms | 用户点击到画布更新 |
| SC-006 | 单局完整流程完成率 | > 95% | 从开始到结算的用户比例 |

---

## Dependencies

| 依赖项 | 说明 | 状态 |
|--------|------|------|
| Feature 001 (Monorepo Scaffold) | 项目结构、构建系统 | ✅ 完成 |
| Feature 002 (WebSocket Room) | 共享类型（CanvasStroke、BrushConfig 等） | ✅ 完成 |
| AI Service (ai-service/) | AI 识别 API（可先 mock） | ⚠️ 需 mock |

---

## Out of Scope

- 联机模式的画布同步（已在 Feature 002 中实现广播基础设施，画布同步 UI 在联机模式 Feature 中完成）
- 故事模式的画布交互
- AI 绘画生成（文生图）—— 这是 M5 的独立 Feature
- 用户系统（登录/注册/JWT）—— 后续 Feature
- 排行榜
- 小程序端画布适配
