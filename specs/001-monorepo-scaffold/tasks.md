# Tasks: Monorepo 脚手架搭建

**Input**: Design documents from `/specs/001-monorepo-scaffold/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: 脚手架阶段不要求 TDD，重点在于基础设施验证。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 项目根目录初始化，创建 Monorepo 骨架

- [x] T001 Create project root structure with `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.gitignore` in `/workspace/`
- [x] T002 [P] Create `.editorconfig` with 2-space indent, utf-8, lf settings in `/workspace/.editorconfig`
- [x] T003 [P] Create `tsconfig.base.json` with strict mode, ES2022 target, module resolution bundler in `/workspace/tsconfig.base.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 代码规范基础设施，所有用户故事依赖

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Setup ESLint flat config with TypeScript, import sorting, prettier integration in `/workspace/eslint.config.mjs`
- [x] T005 [P] Setup Prettier config with single quotes, 120 print width, 2-space indent in `/workspace/.prettierrc`
- [x] T006 [P] Setup Commitlint with conventional commits config in `/workspace/commitlint.config.mjs`
- [x] T007 Setup Husky 9.x with pre-commit (lint-staged) and commit-msg (commitlint) hooks in `/workspace/.husky/`
- [x] T008 [P] Create VS Code workspace settings with format-on-save and eslint flat config support in `/workspace/.vscode/settings.json`
- [x] T009 [P] Create VS Code recommended extensions list in `/workspace/.vscode/extensions.json`
- [x] T010 [P] Create GitHub Actions CI workflow with lint, typecheck, build jobs in `/workspace/.github/workflows/ci.yml`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Monorepo 基础仓库初始化 (Priority: P1) 🎯 MVP

**Goal**: 创建完整的 Monorepo 目录结构和所有子包的脚手架

**Independent Test**: `pnpm install && pnpm build` 所有包成功安装依赖并构建

### Implementation for User Story 1

- [x] T011 [P] [US1] Initialize shared package `@draw-guess/shared` with TypeScript types, utils, constants in `/workspace/packages/shared/`
- [x] T012 [P] [US1] Initialize web app `@draw-guess/web` with React 18 + Vite 5 + TypeScript in `/workspace/apps/web/`
- [x] T013 [P] [US1] Initialize miniprogram app `@draw-guess/miniprogram` with Taro 4.x + React + TypeScript in `/workspace/apps/miniprogram/`
- [x] T014 [P] [US1] Initialize server app `@draw-guess/server` with NestJS 10 + TypeScript in `/workspace/apps/server/`
- [x] T015 [P] [US1] Initialize ai-service app `draw-guess-ai-service` with Python FastAPI + package.json bridge in `/workspace/apps/ai-service/`
- [x] T016 [US1] Configure Turborepo tasks: build, lint, typecheck, dev, clean in `/workspace/turbo.json` (depends on T011-T015)
- [x] T017 [US1] Verify all packages build successfully with `pnpm build` (depends on T016)

**Checkpoint**: All 5 packages initialized and buildable

---

## Phase 4: User Story 2 - 共享包配置 (Priority: P1)

**Goal**: 在 shared 包中定义跨包共享的类型和工具

**Independent Test**: 在其他包中 import `@draw-guess/shared` 的类型和函数，TypeScript 类型检查通过

### Implementation for User Story 2

- [x] T018 [P] [US2] Define game-related types (GameMode, GameRoom, PlayerInfo, GuessResult) in `/workspace/packages/shared/src/types/game.ts`
- [x] T019 [P] [US2] Define user-related types (User, AuthToken, LoginRequest) in `/workspace/packages/shared/src/types/user.ts`
- [x] T020 [P] [US2] Define story-related types (Story, StoryChapter, DrawingPrompt) in `/workspace/packages/shared/src/types/story.ts`
- [x] T021 [P] [US2] Define canvas-related types (CanvasStroke, BrushConfig, CanvasState) in `/workspace/packages/shared/src/types/canvas.ts`
- [x] T022 [US2] Define game constants (GAME_MODES, MAX_PLAYERS, ROUND_TIMES) in `/workspace/packages/shared/src/constants/game.ts`
- [x] T023 [US2] Define API constants (API_ROUTES, WS_EVENTS) in `/workspace/packages/shared/src/constants/api.ts`
- [x] T024 [US2] Implement utility functions (formatScore, calculateTimeBonus, generateInviteCode) in `/workspace/packages/shared/src/utils/scoring.ts` and `/workspace/packages/shared/src/utils/room.ts`
- [x] T025 [US2] Create barrel export in `/workspace/packages/shared/src/index.ts`
- [x] T026 [US2] Add `@draw-guess/shared` as dependency in web, miniprogram, server `package.json` and verify cross-package imports

**Checkpoint**: Shared types and utilities available to all consuming packages

---

## Phase 5: User Story 3 - 代码规范与质量保障 (Priority: P1)

**Goal**: 确保 ESLint、Prettier、Husky、Commitlint 在子包中正常工作

**Independent Test**: 提交不规范代码被 pre-commit hook 拒绝，不规范 commit message 被 commit-msg hook 拒绝

### Implementation for User Story 3

- [x] T027 [P] [US3] Create per-package ESLint config extending root, adding framework-specific rules in `/workspace/apps/web/eslint.config.mjs`, `/workspace/apps/miniprogram/eslint.config.mjs`, `/workspace/apps/server/eslint.config.mjs`
- [x] T028 [US3] Add lint scripts to root `package.json`: `lint`, `lint:fix`, `typecheck`, `clean`
- [x] T029 [US3] Configure lint-staged in root `package.json` to run ESLint + Prettier on staged files
- [x] T030 [US3] Verify pre-commit hook: intentionally create lint error, attempt commit, confirm rejection
- [x] T031 [US3] Verify commit-msg hook: attempt commit with invalid message format, confirm rejection
- [x] T032 [US3] Run full lint pass: `pnpm lint` across all packages, fix any remaining issues

**Checkpoint**: Code quality gates active and verified

---

## Phase 6: User Story 4 - CI/CD 基础流水线 (Priority: P2)

**Goal**: GitHub Actions 自动执行代码检查

**Independent Test**: CI workflow 配置文件语法正确，本地可用 `act` 或推送后 Actions 正常触发

### Implementation for User Story 4

- [x] T033 [US4] Review and finalize CI workflow: lint, typecheck, build jobs with correct pnpm cache in `/workspace/.github/workflows/ci.yml`
- [x] T034 [US4] Verify CI workflow locally: ensure `pnpm lint && pnpm typecheck && pnpm build` passes as a single command

**Checkpoint**: CI pipeline ready for GitHub integration

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 最终验证和清理

- [x] T035 [P] Verify `.gitignore` covers all generated files: `node_modules/`, `dist/`, `build/`, `.turbo/`, `*.log`, `.env*`, `__pycache__/`, `.venv/`
- [x] T036 Run quickstart.md validation: simulate new developer experience from clone to build
- [x] T037 [P] Ensure all `package.json` files use `catalog:` references for dependencies
- [x] T038 Final verification: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm build` all pass with zero errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - Creates all packages
- **User Story 2 (Phase 4)**: Depends on US1 (needs packages to exist) - Fills shared package
- **User Story 3 (Phase 5)**: Depends on US1 (needs packages to lint) - Quality gates
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2 CI file) - CI validation
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after US1 packages exist - Shared types for all packages
- **User Story 3 (P1)**: Can start after US1 - Quality gates applied to existing code
- **User Story 4 (P2)**: Can start after Foundational - CI file already scaffolded in Phase 2

### Within Each User Story

- Models/Types before services
- Package creation before dependency linking
- Implementation before verification
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T002, T003 can run in parallel
- **Phase 2**: T005, T006, T008, T009, T010 can all run in parallel
- **Phase 3**: T011-T015 (all 5 packages) can run in parallel
- **Phase 4**: T018-T021 (all type files) can run in parallel
- **Phase 5**: T027 can run in parallel with other Phase 5 tasks
- **Phase 7**: T035, T037 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all 5 package initializations in parallel:
Task: "Initialize shared package @draw-guess/shared"
Task: "Initialize web app @draw-guess/web with React 18 + Vite 5"
Task: "Initialize miniprogram app @draw-guess/miniprogram with Taro 4.x"
Task: "Initialize server app @draw-guess/server with NestJS 10"
Task: "Initialize ai-service app draw-guess-ai-service with Python FastAPI"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 - All packages initialized
4. **STOP and VALIDATE**: `pnpm install && pnpm build`
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → All packages scaffolded → Build verification (MVP!)
3. Add User Story 2 → Shared types available → Cross-package imports work
4. Add User Story 3 → Quality gates active → Pre-commit hooks enforced
5. Add User Story 4 → CI pipeline ready → Automated checks on push
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Total tasks: 38 (T001-T038)
