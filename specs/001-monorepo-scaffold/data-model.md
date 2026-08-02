# Data Model: Monorepo 脚手架搭建

**Feature**: 001-monorepo-scaffold
**Date**: 2026-08-02

## 实体模型

本 feature 不涉及数据库实体，以下为项目结构和配置模型。

### 1. Workspace 配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `packages` | `string[]` | workspace 包路径列表，值为 `["apps/*", "packages/*"]` |
| `catalog` | `Record<string, string>` | 默认依赖目录，统一管理核心依赖版本 |
| `catalogs` | `Record<string, Record<string, string>>` | 命名依赖目录（如 react18） |
| `catalogMode` | `"strict"` | 强制所有依赖走 catalog |

### 2. Turbo 任务配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `tasks.build` | `TaskConfig` | 构建任务：`dependsOn: ["^build"]`，声明 outputs |
| `tasks.lint` | `TaskConfig` | Lint 任务：`dependsOn: ["^build"]` |
| `tasks.typecheck` | `TaskConfig` | 类型检查任务 |
| `tasks.dev` | `TaskConfig` | 开发服务器：`cache: false, persistent: true` |
| `tasks.clean` | `TaskConfig` | 清理任务：`cache: false` |

### 3. 子包结构

```
draw-guess-ai/
├── apps/
│   ├── web/                  # @draw-guess/web
│   │   ├── package.json      # React 18 + Vite 5 + TypeScript 5
│   │   ├── tsconfig.json     # extends ../../tsconfig.base.json
│   │   ├── vite.config.ts
│   │   └── src/
│   ├── miniprogram/          # @draw-guess/miniprogram
│   │   ├── package.json      # Taro 4.x + React 18 + TypeScript 5
│   │   ├── tsconfig.json
│   │   ├── babel.config.js
│   │   └── src/
│   ├── server/               # @draw-guess/server
│   │   ├── package.json      # NestJS 10 + TypeScript 5
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── nest-cli.json
│   │   └── src/
│   └── ai-service/           # draw-guess-ai-service
│       ├── package.json      # Python bridge (scripts only)
│       ├── pyproject.toml    # Python 项目配置
│       └── src/
└── packages/
    ├── shared/               # @draw-guess/shared
    │   ├── package.json      # 纯 TypeScript 类型 + 工具
    │   ├── tsconfig.json
    │   └── src/
    └── config/               # @draw-guess/config (optional)
        ├── package.json      # 共享配置（ESLint, tsconfig）
        └── ...
```

### 4. 根配置文件清单

| 文件 | 用途 |
|------|------|
| `package.json` | 根包配置，含 `private: true`, `packageManager`, 统一脚本 |
| `pnpm-workspace.yaml` | workspace 声明 + catalogs |
| `turbo.json` | Turborepo 任务编排 |
| `tsconfig.base.json` | 基础 TypeScript 配置 |
| `eslint.config.mjs` | ESLint flat config |
| `.prettierrc` | Prettier 配置 |
| `.editorconfig` | 编辑器基础配置 |
| `.npmrc` | pnpm 配置 |
| `.gitignore` | Git 忽略规则 |
| `.vscode/settings.json` | VS Code 工作区设置 |
| `.vscode/extensions.json` | 推荐扩展列表 |
| `.github/workflows/ci.yml` | CI 流水线 |
| `.husky/pre-commit` | pre-commit hook |
| `.husky/commit-msg` | commit-msg hook |
| `commitlint.config.mjs` | Commitlint 配置 |

### 5. Catalog 依赖版本（初始值）

| 依赖 | 版本 | 说明 |
|------|------|------|
| `react` | `^18.3.1` | React 核心 |
| `react-dom` | `^18.3.1` | React DOM |
| `typescript` | `^5.6.3` | TypeScript |
| `@types/react` | `^18.3.12` | React 类型 |
| `@types/react-dom` | `^18.3.1` | React DOM 类型 |
| `vite` | `^5.4.11` | 构建工具 (web) |
| `@vitejs/plugin-react` | `^4.3.4` | Vite React 插件 |
| `@nestjs/common` | `^10.4.15` | NestJS 核心 |
| `@nestjs/core` | `^10.4.15` | NestJS 核心 |
| `@nestjs/platform-express` | `^10.4.15` | NestJS HTTP 适配器 |
| `@tarojs/cli` | `^4.0.9` | Taro CLI |
| `@tarojs/components` | `^4.0.9` | Taro 组件 |
| `@tarojs/taro` | `^4.0.9` | Taro 运行时 |
| `eslint` | `^9.15.0` | ESLint |
| `prettier` | `^3.4.2` | Prettier |
| `turbo` | `^2.3.3` | Turborepo |

> **注**: 具体版本号将在实现阶段通过 `pnpm install` 获取最新兼容版本。
