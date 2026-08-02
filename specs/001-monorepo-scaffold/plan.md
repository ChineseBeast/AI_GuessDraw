# Implementation Plan: Monorepo 脚手架搭建

**Branch**: `001-monorepo-scaffold` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-monorepo-scaffold/spec.md`

## Summary

搭建你画我猜AI项目的 Monorepo 开发环境，使用 Turborepo 2.x + pnpm 10.x 管理多包仓库。包含 Web 前端（React 18 + Vite 5）、小程序前端（Taro 4.x）、后端服务（NestJS 10）、AI 服务（Python FastAPI）和共享包（shared types/utils）。配置统一的代码规范（ESLint flat config + Prettier）、Git Hooks（Husky + lint-staged + Commitlint）和 CI/CD 基础流水线（GitHub Actions）。

## Technical Context

**Language/Version**: TypeScript 5.6+ / Node.js 22.14+ / Python 3.11+

**Primary Dependencies**: Turborepo 2.x, pnpm 10.x, React 18, Vite 5, Taro 4.x, NestJS 10, FastAPI 0.100+

**Storage**: N/A（脚手架阶段不涉及数据库）

**Testing**: Vitest (web/shared), Jest (server), pytest (ai-service)

**Target Platform**: Linux/macOS/Windows 开发环境，Web 浏览器 + 微信小程序

**Project Type**: Monorepo（Web 应用 + 小程序 + 后端服务 + AI 服务）

**Performance Goals**: `pnpm build` 首次 < 2 分钟，缓存命中 < 10 秒；pre-commit hook < 5 秒

**Constraints**: 所有子包 TypeScript strict 模式；ESLint 0 error；catalogMode strict

**Scale/Scope**: 4 个 app 包 + 1-2 个 package 包，7 人团队协作

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| 原则 | 状态 | 说明 |
|------|------|------|
| I. Spec-First Development | ✅ PASS | 本 spec 遵循 SpecKit 流程，spec → plan → tasks |
| II. 用户价值优先 | ✅ PASS | 4 个用户故事按优先级组织，P1 可独立交付 |
| III. 跨平台一致性 | ✅ PASS | shared 包统一类型，config 包统一规范 |
| IV. AI 服务质量 | ✅ N/A | 脚手架阶段不涉及 AI 服务开发 |
| V. 实时通信可靠性 | ✅ N/A | 脚手架阶段不涉及 WebSocket |

## Project Structure

### Documentation (this feature)

```text
specs/001-monorepo-scaffold/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── README.md
└── tasks.md             # Phase 2 output (speckit-tasks)
```

### Source Code (repository root)

```text
draw-guess-ai/
├── apps/
│   ├── web/                     # @draw-guess/web (React + Vite)
│   │   ├── src/
│   │   │   ├── components/      # 通用组件
│   │   │   ├── pages/           # 页面
│   │   │   ├── hooks/           # Hooks
│   │   │   ├── services/        # API 调用
│   │   │   └── main.tsx         # 入口
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   ├── miniprogram/             # @draw-guess/miniprogram (Taro)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── app.config.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── babel.config.js
│   │   └── project.config.json
│   ├── server/                  # @draw-guess/server (NestJS)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   ├── common/
│   │   │   ├── config/
│   │   │   └── main.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   └── nest-cli.json
│   └── ai-service/              # draw-guess-ai-service (Python)
│       ├── src/
│       │   ├── routers/
│       │   ├── services/
│       │   └── main.py
│       ├── package.json         # 桥接脚本
│       ├── pyproject.toml
│       └── requirements.txt
├── packages/
│   └── shared/                  # @draw-guess/shared
│       ├── src/
│       │   ├── types/
│       │   ├── utils/
│       │   ├── constants/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── .github/
│   └── workflows/
│       └── ci.yml
├── .husky/
│   ├── pre-commit
│   └── commit-msg
├── .specify/                    # SpecKit 配置
├── specs/                       # 功能规格目录
├── package.json                 # 根配置
├── pnpm-workspace.yaml          # workspace + catalogs
├── turbo.json                   # Turborepo 任务编排
├── tsconfig.base.json           # 基础 TS 配置
├── eslint.config.mjs            # ESLint flat config
├── .prettierrc                  # Prettier 配置
├── .editorconfig                # 编辑器配置
├── .npmrc                       # pnpm 配置
├── .gitignore                   # Git 忽略
└── commitlint.config.mjs        # Commitlint 配置
```

**Structure Decision**: 采用 `apps/` + `packages/` 分层结构。`apps/` 存放可部署的应用（web, miniprogram, server, ai-service），`packages/` 存放被复用的库（shared）。符合 Turborepo 官方推荐模式。

## Complexity Tracking

> 无 Constitution Check 违规，无需追踪。
