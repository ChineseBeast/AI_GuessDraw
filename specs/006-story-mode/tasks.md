# Tasks: 故事模式

**Feature**: 006-story-mode | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Shared Contracts

- [x] T001 [P] 扩展 `packages/shared/src/types/story.ts` 的章节、评价、进度和 API DTO 类型
- [x] T002 [P] 校正 `packages/shared/src/constants/api.ts` 的故事模式路由常量

## Phase 2: AI Story Service

- [x] T003 [P] 在 `apps/ai-service/src/schemas.py` 增加故事生成与画作评价模型
- [x] T004 [US1] 在 `apps/ai-service/src/services/story_service.py` 实现三主题模板生成
- [x] T005 [US2] 在 `apps/ai-service/src/services/story_service.py` 实现 AI 优先、启发式降级评价
- [x] T006 [US1] [US2] 在 `apps/ai-service/src/routers/ai.py` 注册 generate-story 与 evaluate-drawing 端点
- [x] T007 [P] 为故事生成和降级评价增加 Python 单元测试

## Phase 3: NestJS Story Module

- [x] T008 [US1] 创建 `apps/server/src/modules/story/story.service.ts` 管理内存进度并调用 AI 服务
- [x] T009 [US1] [US2] 创建 `apps/server/src/modules/story/story.controller.ts` 实现 start、submit、progress
- [x] T010 [US1] 创建 `apps/server/src/modules/story/story.module.ts` 并注册到 AppModule
- [x] T011 [P] 为开始故事、章节推进、重复提交和结局增加 Jest 单元测试

## Phase 4: Web Story Experience

- [x] T012 [P] 创建 `apps/web/src/services/story.service.ts`
- [x] T013 [US1] [US2] 创建 `apps/web/src/hooks/useStory.ts` 管理异步状态和章节推进
- [x] T014 [US1] 在 `apps/web/src/pages/story/index.tsx` 实现主题选择和故事开始
- [x] T015 [US2] 在 `apps/web/src/pages/story/index.tsx` 复用 Canvas 实现绘画、工具栏与提交
- [x] T016 [US2] 在 `apps/web/src/pages/story/index.tsx` 实现评价卡和下一章流转
- [x] T017 [US3] 在 `apps/web/src/pages/story/index.tsx` 实现结局与章节回顾
- [x] T018 [US1] 修改 `apps/web/src/main.tsx` 启用故事模式入口和页面路由

## Phase 5: Verification

- [x] T019 运行 Python 故事单元测试
- [x] T020 运行 shared、server、web 构建与相关测试
- [x] T021 按 `quickstart.md` 完成浏览器三章验收
- [x] T022 更新任务勾选和开发结果，不提交代码，等待用户确认
- [x] T023 移除单机模式 AI 画家选择页，并将单机与故事模式固定为 MiniMax-M3

## Verification Notes

- Python: 3 tests passed.
- NestJS: build passed; 3 story tests passed.
- Web: Vite production build passed with 105 modules.
- Browser: completed all three chapters and reached the ending with no console errors.
- Repository-wide Web `tsc --noEmit` still reports pre-existing React declaration and multiplayer Canvas implicit-any errors outside this feature.

## Submission Gate

All implementation remains unstaged and uncommitted until the user explicitly approves the commit.
