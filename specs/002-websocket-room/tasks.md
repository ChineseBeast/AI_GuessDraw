# Tasks: WebSocket 房间管理系统

**Input**: Design documents from `/specs/002-websocket-room/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: 服务端核心逻辑（状态机、计分、猜词匹配）要求单元测试；WebSocket 集成测试覆盖关键事件流。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 服务端 WebSocket 基础设施搭建，为所有用户故事提供基础

- [x] T001 Install Socket.IO dependencies in server: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `nanoid` in `/workspace/apps/server/`
- [x] T002 [P] Install Socket.IO client dependency in web: `socket.io-client` in `/workspace/apps/web/`
- [x] T003 [P] Define WebSocket event type constants and interfaces in `/workspace/packages/shared/src/types/game.ts` (add Room, Player, GameSession, Round, Guess types + WS event enums)
- [x] T004 [P] Add game constants for multiplayer mode (ROUND_TIME, RECONNECT_WINDOW, ROOM_CLEANUP_TIMEOUT, SCORING_RULES) in `/workspace/packages/shared/src/constants/game.ts`
- [x] T005 [P] Create static word library in `/workspace/apps/server/src/data/words.json` (easy/medium/hard categories, 10+ words each)

---

## Phase 2: Foundational — Room Manager & Gateway (Blocking Prerequisites)

**Purpose**: 房间管理核心逻辑 + WebSocket Gateway，所有用户故事依赖

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create WebSocket gateway boilerplate with Socket.IO adapter in `/workspace/apps/server/src/gateway/room.gateway.ts`
- [x] T007 Create RoomManager service with in-memory Map storage, room CRUD methods in `/workspace/apps/server/src/services/room-manager.service.ts`
- [x] T008 [P] Create invite code generator using nanoid (6 chars, exclude ambiguous chars) in `/workspace/apps/server/src/services/room-manager.service.ts` (part of T007)
- [x] T009 Create WebSocket type definitions file in `/workspace/apps/server/src/types/websocket.types.ts`
- [x] T010 Register WebSocket gateway and services in NestJS AppModule in `/workspace/apps/server/src/app.module.ts`
- [x] T011 [P] Create client Socket.IO service wrapper with auth, auto-reconnect, event helpers in `/workspace/apps/web/src/services/socket.service.ts`
- [x] T012 [P] Create useSocket hook for React component integration in `/workspace/apps/web/src/hooks/useSocket.ts`

**Checkpoint**: Gateway 可启动，客户端可建立 WebSocket 连接 ✅

---

## Phase 3: User Story 1 — 创建与加入房间 (Priority: P1) 🎯 MVP

**Goal**: 玩家可创建房间（生成邀请码）、通过邀请码加入、离开房间，房间内实时更新玩家列表

**Independent Test**: 两个客户端 → 一个创建房间 → 另一个用邀请码加入 → 双方看到玩家列表更新

### Implementation for User Story 1

- [x] T013 [US1] Implement `create_room` event handler in room.gateway.ts — validate config, create room via RoomManager, return invite code, join socket to room
- [x] T014 [US1] Implement `join_room` event handler in room.gateway.ts — validate invite code, check room capacity, add player, broadcast `player_joined`
- [x] T015 [US1] Implement `leave_room` event handler in room.gateway.ts — remove player from room, broadcast `player_left`, cleanup empty rooms
- [x] T016 [US1] Handle Socket.IO `disconnect` event — mark player as disconnected, start 30s timer, broadcast `player_disconnected`
- [x] T017 [US1] Create room lobby page UI in `/workspace/apps/web/src/pages/multiplayer/lobby.tsx` (create room form + join room form)
- [x] T018 [US1] Create waiting room page UI in `/workspace/apps/web/src/pages/multiplayer/room.tsx` (player list, invite code display, start game button for host)
- [x] T019 [US1] Create useRoom hook managing room state (players, host, status) in `/workspace/apps/web/src/hooks/useRoom.ts`
- [x] T020 [US1] Write unit tests for RoomManager service (create, join, leave, capacity check, cleanup) in `/workspace/apps/server/src/services/room-manager.service.spec.ts` ✅

**Checkpoint**: 房间创建/加入/离开完整流程可演示 ✅

---

## Phase 4: User Story 2 — 实时画布同步 (Priority: P1)

**Goal**: 绘画者的画布操作实时广播给房间内所有其他玩家，延迟 < 100ms

**Independent Test**: 两名玩家 → 一人绘画 → 另一人实时看到相同笔画

### Implementation for User Story 2

- [x] T021 [US2] Implement `canvas_action` event handler in room.gateway.ts — validate drawer role, assign sequence number, broadcast `canvas_sync` to all except sender
- [x] T022 [US2] Add stroke storage to RoomManager — append strokes to current round with sequence numbers
- [x] T023 [US2] Implement Douglas-Peucker path simplification utility in `/workspace/apps/server/src/services/room-manager.service.ts` (optional optimization, can be client-side)
- [x] T024 [US2] Create canvas drawing component (basic) in `/workspace/apps/web/src/components/canvas/CanvasBoard.tsx` with mouse/touch drawing, color picker, brush size, eraser, undo, clear → **Implemented via `@draw-guess/ui` Canvas component (Feature 003)**
- [x] T025 [US2] Create useCanvas hook managing local canvas state + remote sync in `/workspace/apps/web/src/hooks/useCanvas.ts` → **Implemented via `useMultiplayerCanvas` hook (Feature 004)**
- [x] T026 [US2] Wire canvas component → useCanvas hook → socket.service for bidirectional sync
- [ ] T027 [US2] Write unit tests for canvas_action handler and sequence numbering in `/workspace/apps/server/src/gateway/room.gateway.spec.ts`

**Checkpoint**: 画布实时同步可演示 — 两人同时看到相同绘画 ✅

---

## Phase 5: User Story 3 — 回合管理与猜词 (Priority: P1)

**Goal**: 完整游戏流程 — 开始游戏 → 分配词汇 → 猜词判定 → 计分 → 轮次切换 → 最终结算

**Independent Test**: 3 人房间 → 开始游戏 → 完整 N 轮 → 查看最终排行榜

### Implementation for User Story 3

- [x] T028 [US3] Create GameEngine service with state machine (waiting→countdown→playing→round_end→next_round→game_end) in `/workspace/apps/server/src/services/game-engine.service.ts`
- [x] T029 [US3] Implement `start_game` event handler in room.gateway.ts — validate host, min players (2+), initialize GameSession, broadcast `game_started` + `round_started`
- [x] T030 [US3] Create WordService for random word selection by difficulty in `/workspace/apps/server/src/services/word.service.ts`
- [x] T031 [US3] Implement `submit_guess` event handler in room.gateway.ts — match guess against target word (exact + fuzzy), calculate score, broadcast results
- [x] T032 [US3] Implement scoring logic in GameEngine: first correct 15pts, second 10pts, third 5pts, drawer 5pts per correct guess
- [x] T033 [US3] Implement round transition logic in GameEngine — end round when all guess or timeout, rotate drawer, broadcast `round_ended` + next `round_started`
- [x] T034 [US3] Implement game end logic in GameEngine — calculate final scores, rank players, broadcast `game_ended` with full summary
- [x] T035 [US3] Create game page UI in `/workspace/apps/web/src/pages/multiplayer/game.tsx` — drawing area (for drawer) or viewing area (for guessers), guess input, timer, scoreboard sidebar
- [x] T036 [US3] Create useGame hook managing game state (current round, scores, timer, role) in `/workspace/apps/web/src/hooks/useGame.ts`
- [x] T037 [US3] Create game result page UI in `/workspace/apps/web/src/pages/multiplayer/result.tsx` — final scores, ranking, round summary, play again button ✅
- [x] T038 [US3] Write unit tests for GameEngine (state machine, scoring, round transitions, edge cases) in `/workspace/apps/server/src/services/game-engine.service.spec.ts` ✅
- [x] T039 [US3] Write unit tests for WordService and guess matching in `/workspace/apps/server/src/services/word.service.spec.ts` ✅

**Checkpoint**: 完整联机对战流程可演示 — 创建房间 → 多人游戏 → 最终结算 ✅ (game.tsx 已集成 game_end 展示)

---

## Phase 6: User Story 4 — 断线处理与状态恢复 (Priority: P2)

**Goal**: 玩家断线检测、30 秒重连窗口、状态恢复、绘画者断线自动切换

**Independent Test**: 游戏中手动断网 → 观察断线提示 → 30 秒内恢复网络 → 验证状态恢复

### Implementation for User Story 4

- [x] T040 [US4] Implement `reconnect` event handler in room.gateway.ts — validate session, restore player state (role, score, round), broadcast `player_reconnected`
- [x] T041 [US4] Enhance disconnect handler — on drawer disconnect timeout: auto-assign next drawer, extend timer 10s, broadcast drawer change
- [x] T042 [US4] Implement host transfer logic — on host disconnect timeout: transfer to earliest joined player, broadcast `host_changed`
- [x] T043 [US4] Add session token generation on room join, stored in player object for reconnection validation
- [x] T044 [US4] Create reconnection UI — disconnected overlay with countdown timer, auto-reconnect attempt, manual retry button → **Implemented in game.tsx (Feature 004)**
- [ ] T045 [US4] Write integration test for disconnect/reconnect flow in `/workspace/apps/server/src/gateway/room.gateway.spec.ts`

**Checkpoint**: 断线重连流程可演示 — 断线 → 重连 → 无缝恢复 ✅

---

## Phase 7: User Story 5 — 观战模式 (Priority: P3)

**Goal**: 游戏开始后新加入者以观众身份观看，可看到画布同步和分数，下一局可选加入

**Independent Test**: 游戏开始后第 4 人加入 → 以观众身份看到游戏 → 游戏结束 → 选择加入下一局

### Implementation for User Story 5

- [x] T046 [US5] Modify `join_room` handler — detect game in progress, route to spectator flow, broadcast minimal spectator join
- [x] T047 [US5] Implement `join_as_spectator` event handler — add to spectators list, send current game state snapshot (scores, round, canvas)
- [x] T048 [US5] Send canvas_sync events to spectators (include them in broadcast list)
- [x] T049 [US5] Block spectator game actions — ignore canvas_action and submit_guess from spectators silently
- [x] T050 [US5] On game_end — prompt spectators with "join next game" option, convert spectator → player on acceptance
- [x] T051 [US5] Add spectator UI indicator — "观看中" badge, disabled guess input, "加入下一局" button → **Implemented in game.tsx (Feature 004)**

**Checkpoint**: 观战模式可演示 — 观众看到完整对局 → 加入下一局 ✅

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 最终验证和清理

- [x] T052 [P] Update shared package barrel export to include new multiplayer types in `/workspace/packages/shared/src/index.ts`
- [x] T053 Verify all packages build successfully: `pnpm build` ✅
- [x] T054 Verify all tests pass: `pnpm test` (server unit + e2e) ✅
- [x] T055 Verify lint passes: `pnpm lint` ✅
- [x] T056 Run quickstart.md validation — simulate new developer setup from clone to running game ✅
- [x] T057 Performance check — verify canvas sync latency < 100ms using browser DevTools ✅
- [x] T058 Multi-client smoke test — 4 browser tabs simulate 4-player game, verify all events flow correctly ✅

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - Room CRUD
- **User Story 2 (Phase 4)**: Depends on US1 (needs room + players) - Canvas sync
- **User Story 3 (Phase 5)**: Depends on US1 (needs room) + US2 (canvas context) - Full game flow
- **User Story 4 (Phase 6)**: Depends on US1 + US3 (game state for reconnect) - Disconnect handling
- **User Story 5 (Phase 7)**: Depends on US1 + US3 (game running for spectating) - Spectator mode
- **Polish (Phase 8)**: Depends on all user stories complete

### Parallel Opportunities

- **Phase 1**: T002, T003, T004, T005 can run in parallel
- **Phase 2**: T008, T011, T012 can run in parallel with T006-T007
- **Phase 3**: T017, T018 can run in parallel (different pages)
- **Phase 5**: T030 (WordService) can run in parallel with T028 (GameEngine)
- **Phase 8**: T052 can run in parallel with tests

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 — Room CRUD
4. Complete Phase 4: User Story 2 — Canvas Sync
5. Complete Phase 5: User Story 3 — Full Game Flow
6. **STOP and VALIDATE**: Full 4-player game test
7. Demo MVP

### Incremental Delivery

1. Setup + Foundational → WebSocket connected
2. Add US1 → Room system → Join/leave demo
3. Add US2 → Canvas sync → Drawing demo
4. Add US3 → Complete game → Playable MVP!
5. Add US4 → Disconnect handling → Robust experience
6. Add US5 → Spectator mode → Social feature

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Total tasks: 58 (T001-T058) | Completed: 53 | Remaining: 5 (gateway + integration tests)
