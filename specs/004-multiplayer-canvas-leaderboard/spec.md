# Feature Specification: 联机画布集成 + 排行榜

**Feature Branch**: `004-multiplayer-canvas-leaderboard`

**Created**: 2026-08-02

**Status**: Draft

**Input**: PRD 3.2 联机模式 MP-004~MP-009 + 3.4 通用功能 CM-004，基于已完成的 Canvas 组件（003）和 WebSocket 房间系统（002）

---

## 概述

本 Feature 将共享 Canvas 组件（Feature 003 交付）集成到联机模式前端，完成实时画布同步 UI；同时构建排行榜系统（后端 API + 前端页面）。这是联机模式从前端占位到完整体验的关键 Feature。

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — 联机画布实时同步 (Priority: P0) 🎯 MVP

绘画者在画布上绘画，所有非绘画者（猜词者 + 观众）实时看到完全同步的笔触渲染。绘画者的每一笔在完成时通过 WebSocket 广播，接收端重建相同的视觉效果。

**Why this priority**: 画布同步是联机模式的核心体验——没有实时画布同步，联机模式就失去了"共同创作"的社交乐趣。

**Independent Test**: 两个浏览器标签页，一个作为绘画者在 canvas 上画一笔，验证另一个标签页中同步渲染出相同的笔画。完全独立验证，无需猜词逻辑。

**Acceptance Scenarios**:

1. **Given** 游戏已开始且用户是绘画者，**When** 用户在画布上画一笔并松开鼠标，**Then** 该笔画的完整数据（points[], brush, tool）通过 `canvas_action` 事件发送至服务器，服务器广播 `canvas_sync` 给房间内所有其他用户。
2. **Given** 用户是猜词者/观众，**When** 收到 `canvas_sync` 事件，**Then** 本地画布实时渲染该笔画，与绘画者的画布内容保持一致。
3. **Given** 绘画者使用橡皮擦擦除部分内容，**When** 擦除操作完成，**Then** 擦除笔触通过 `canvas_sync` 广播，接收端同样执行擦除操作。
4. **Given** 绘画者点击撤销，**When** 撤销操作完成，**Then** `canvas_sync(type: 'undo')` 广播，所有客户端同步撤销最后一条笔画。
5. **Given** 绘画者点击清空画布，**When** 清空操作完成，**Then** `canvas_sync(type: 'clear')` 广播，所有客户端画布清空。
6. **Given** 新回合开始，**When** 切换绘画者，**Then** 所有客户端画布清空，新绘画者获得绘画权限。

---

### User Story 2 — 联机猜词完整交互 (Priority: P0)

猜词者看到实时同步的画布内容，在猜词输入框中输入猜测，提交后收到即时反馈（正确/接近/字数匹配/错误）。猜对者显示在侧边栏，剩余猜词者继续猜。

**Why this priority**: 猜词是联机模式的另一半核心体验——画布同步让玩家看到画，猜词让玩家互动。

**Independent Test**: 两个客户端，一个绘画一个猜词。猜词者提交正确词汇，验证双方都收到 correct_guess 事件和分数更新。可独立验证。

**Acceptance Scenarios**:

1. **Given** 用户是猜词者且回合进行中，**When** 用户在输入框中输入猜测并提交，**Then** 系统通过 WebSocket 发送 `submit_guess` 事件至服务器。
2. **Given** 服务器处理猜词，**When** 猜测正确，**Then** 猜词者收到 `guess_result(isCorrect: true)` + `correct_guess` 广播给全房间，猜词输入框禁用。
3. **Given** 服务器处理猜词，**When** 猜测接近（编辑距离 ≤ 1），**Then** 猜词者收到 `guess_result(isCorrect: false, proximity: 'close')` 提示"很接近了！"
4. **Given** 服务器处理猜词，**When** 猜测字数匹配但内容不对，**Then** 收到 `guess_result(proximity: 'length_match')` 提示"字数对了！"
5. **Given** 所有猜词者都猜对或时间耗尽，**When** 回合结束，**Then** 所有客户端显示回合结果（答案、得分、当前总分）。

---

### User Story 3 — 排行榜 (Priority: P0)

系统提供全局排行榜，展示所有玩家的累计得分排名。支持周榜/月榜/总榜三种时间范围切换。

**Why this priority**: 排行榜是激励用户持续游玩的核心机制，PRD 中列为 P0 需求。

**Independent Test**: 完成几局单机/联机游戏 → 访问排行榜页面 → 验证得分正确显示和排序。可独立验证。

**Acceptance Scenarios**:

1. **Given** 用户访问排行榜页面，**When** 页面加载完成，**Then** 系统展示 Top 50 玩家排名列表，包括排名、昵称、得分、游戏场次。
2. **Given** 排行榜页面展示中，**When** 用户点击「本周」标签，**Then** 列表切换为本周得分排名。
3. **Given** 排行榜页面展示中，**When** 用户点击「本月」标签，**Then** 列表切换为本月得分排名。
4. **Given** 排行榜页面展示中，**When** 用户点击「全部」标签，**Then** 列表切换为历史总得分排名。
5. **Given** 当前用户已在排行榜中，**When** 列表渲染，**Then** 当前用户的行高亮显示（蓝色背景）。

---

### User Story 4 — 联机游戏完整页面流转 (Priority: P1)

从首页选择联机模式 → 创建/加入房间 → 等待大厅 → 游戏开始 → 游戏结束 → 返回首页，全流程页面无缝流转。

**Why this priority**: 页面流转是用户体验的骨架。当前 lobby.tsx 和 game.tsx 已存在但互相独立。

**Independent Test**: 从首页开始，完整走通联机模式流程（创建房间 → 加入 → 开始游戏 → 结束）。

**Acceptance Scenarios**:

1. **Given** 用户在首页，**When** 点击「联机模式」，**Then** 进入联机大厅（创建/加入房间页面）。
2. **Given** 用户在联机大厅，**When** 创建或加入房间成功，**Then** 进入等待大厅，显示玩家列表和邀请码。
3. **Given** 房主在等待大厅且 ≥ 2 人，**When** 点击「开始游戏」，**Then** 所有玩家进入游戏页面，3 秒倒计时后第一轮开始。
4. **Given** 游戏结束，**When** 显示最终排名，**Then** 用户可点击「返回大厅」回到联机大厅或「再来一局」重新开始。

---

### Edge Cases

- **绘画者快速连续画多笔**: canvas_action 事件按序列号排序，接收端按序渲染，不丢失不乱序。
- **中途加入观战**: 观众加入时服务器发送当前画布完整快照（所有已广播的笔画重放），确保观众看到最新画布状态。
- **网络延迟导致笔画跳跃**: 笔画 points 包含完整路径数据，接收端按路径重绘，不依赖实时增量。
- **排行榜数据为空**: 显示"暂无排行数据，快去玩一局吧！"引导用户去游戏。
- **排行榜数据更新**: 游戏结束后自动提交得分，排行榜数据近实时更新（无需刷新）。

---

## Functional Requirements

| 编号 | 需求描述（EARS） | 优先级 |
|------|-----------------|--------|
| MP-004 | **The system shall** integrate the shared Canvas component into the multiplayer game page, rendering strokes in real-time from `canvas_sync` WebSocket events. | P0 |
| MP-005 | **When** a `canvas_sync` event is received with type 'draw' or 'erase', **the system shall** render the stroke on the local canvas with the same brush configuration and point array. | P0 |
| MP-006 | **When** a `canvas_sync` event is received with type 'undo', **the system shall** remove the last stroke from the local canvas. | P0 |
| MP-007 | **When** a `canvas_sync` event is received with type 'clear', **the system shall** clear the local canvas. | P0 |
| MP-008 | **The system shall** disable canvas drawing interactions for non-drawer players (guessers and spectators). | P0 |
| MP-009 | **The system shall** display the drawer's word prominently on the drawer's screen and hide it (showing underscores) for all other players. | P0 |
| MP-010 | **The system shall** provide a guess input field for non-drawer players with real-time feedback (correct/close/length_match/wrong). | P0 |
| MP-011 | **The system shall** display a sorted scoreboard in the game sidebar, updating in real-time as players score points. | P0 |
| LB-001 | **The system shall** provide a REST API endpoint `GET /api/leaderboard` with query parameters `period` (weekly/monthly/all) and `limit` (default 50). | P0 |
| LB-002 | **The system shall** return leaderboard data sorted by score descending, including player nickname, total score, and games played. | P0 |
| LB-003 | **The system shall** support a `POST /api/leaderboard/submit` endpoint to submit game results for leaderboard ranking. | P0 |
| LB-004 | **The system shall** create a leaderboard page accessible from the home page, with period filter tabs. | P0 |
| FL-001 | **The system shall** support seamless page transitions: home → lobby → game → result → home. | P1 |
| FL-002 | **The system shall** handle the full multiplayer game lifecycle including reconnection UI, spectator join, and game restart. | P1 |

---

## Success Criteria

| 编号 | 指标 | 目标值 | 测量方式 |
|------|------|--------|----------|
| SC-001 | 画布同步延迟 | < 100ms P95 | WebSocket 事件时间戳差值 |
| SC-002 | 笔画渲染帧率 | ≥ 60fps（接收端） | Chrome DevTools Performance |
| SC-003 | 排行榜查询响应 | < 200ms | API 响应时间 |
| SC-004 | 联机完整流程成功率 | > 95% | 从创建房间到游戏结束 |
| SC-005 | 页面切换时间 | < 500ms | React 状态切换时间 |

---

## Dependencies

| 依赖项 | 说明 | 状态 |
|--------|------|------|
| Feature 001 (Monorepo) | 项目基础设施 | ✅ |
| Feature 002 (WebSocket Room) | 房间管理、游戏引擎、WebSocket 事件 | ✅ |
| Feature 003 (Canvas + Single Player) | 共享 Canvas 组件 (`@draw-guess/ui`) | ✅ |
