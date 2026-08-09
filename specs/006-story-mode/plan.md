# Implementation Plan: 故事模式

**Branch**: `dev-gd` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

## Summary

实现一个三章式绘画冒险：FastAPI 提供模板故事与 AI/降级画作评价，NestJS 管理故事进度和章节状态，React 复用共享 Canvas 呈现主题选择、章节绘画、评价与结局。

## Technical Context

**Language/Version**: TypeScript 5.9、Node 22+、Python 3.11+

**Primary Dependencies**: React 18、Vite 5、NestJS 10、FastAPI、Pydantic、httpx

**Storage**: NestJS 进程内 Map（MVP）

**Testing**: Vitest、Jest、Python unittest、浏览器验收

**Target Platform**: Web 桌面与移动浏览器

**Project Type**: pnpm/Turborepo Web application + API services

**Performance Goals**: 降级评价 <1s；外部 AI 总等待上限 15s；画布交互保持 60fps

**Constraints**: 无数据库、不得在前端暴露 API key、AI 失败不得阻断流程、单图 ≤5MB

**Scale/Scope**: 3 个主题、每局 3 章、单进程开发环境

## Constitution Check

| Principle | Result | Evidence |
|---|---|---|
| I. Spec-First | PASS | spec → plan → tasks → implementation |
| II. 用户价值优先 | PASS | P0 覆盖开始故事与绘画推进，P1 完成结局闭环 |
| III. 跨平台一致性 | PASS | 类型放入 packages/shared，画布复用 packages/ui |
| IV. AI 服务质量 | PASS | 外部模型失败自动降级，提供明确评价模式 |
| Security & Privacy | PASS | Web 不接触密钥，图片只在本地服务链路和内存中使用 |

## Project Structure

```text
specs/006-story-mode/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/story-api.md
└── tasks.md

packages/shared/src/types/story.ts
apps/ai-service/src/
├── schemas.py
├── routers/ai.py
└── services/story_service.py
apps/server/src/modules/story/
├── story.controller.ts
├── story.module.ts
├── story.service.ts
└── story.service.spec.ts
apps/web/src/
├── hooks/useStory.ts
├── services/story.service.ts
└── pages/story/index.tsx
```

**Structure Decision**: 遵循现有 Web → NestJS → FastAPI 分层；共享契约置于 `packages/shared`，不新增 workspace 包。

## Key Decisions

1. 故事固定三章，避免无限上下文和不可控成本。
2. 低分走 alternative 分支但仍推进，避免失败状态阻断儿童用户。
3. FastAPI 对故事接口始终提供本地降级结果。
4. NestJS 是故事进度唯一状态源，前端只保存当前响应。
5. 本期不引入认证守卫，游客与登录用户都可游玩。

## Complexity Tracking

无 Constitution 违规，不需要例外。
