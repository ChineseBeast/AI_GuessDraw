# Research: Monorepo 脚手架搭建

**Feature**: 001-monorepo-scaffold
**Date**: 2026-08-02

## 技术决策

### 1. Monorepo 工具链：Turborepo 2.x + pnpm 10.x

**Decision**: 使用 Turborepo 2.x（`tasks` 配置） + pnpm 10.x（catalogs 特性）

**Rationale**:
- Turborepo 2.x 使用 `tasks` 替代 1.x 的 `pipeline`，支持更丰富的任务配置（`inputs`, `env` 通配符等）
- pnpm 10.x 内置 `catalog` 和 `catalogMode: strict`，可在 workspace 级别锁定依赖版本，杜绝版本漂移
- 两者配合提供顶级的 Monorepo 体验：依赖管理 + 构建缓存 + 并行任务调度

**Alternatives considered**:
- Nx: 功能更丰富但学习曲线陡峭，对简单项目过重
- Lerna + pnpm: Lerna 已进入维护模式，Turborepo 是 Vercel 主推方案
- Rush: 微软方案，配置复杂，适合超大规模项目

### 2. 包管理器版本锁定

**Decision**: 根 `package.json` 中使用 `"packageManager": "pnpm@10.8.0"` + Corepack 管理

**Rationale**:
- Corepack 是 Node.js 内置的包管理器版本管理工具，无需额外安装
- 确保全团队和 CI 环境使用完全相同的 pnpm 版本
- `packageManager` 字段被 Node.js、GitHub Actions、Vercel 等平台原生支持

### 3. pnpm Catalogs 策略

**Decision**: 启用 `catalogMode: strict`，所有子包依赖版本通过 catalog 统一管理

**Rationale**:
- pnpm 10.x 的 catalogs 可集中管理 React、TypeScript、NestJS 等核心依赖版本
- `strict` 模式强制子包必须通过 `catalog:` 引用版本，禁止裸版本号
- 升级依赖只需改 `pnpm-workspace.yaml` 一处，然后 `pnpm update -r`

### 4. 目录结构策略

**Decision**: 使用 `apps/*` + `packages/*` 分层结构

**Rationale**:
- `apps/`: 可独立部署的应用（web, miniprogram, server, ai-service）
- `packages/`: 被复用的库（shared, config）
- 符合 Turborepo 官方推荐和社区最佳实践
- 清晰区分"部署单元"和"共享库"

### 5. TypeScript 配置策略

**Decision**: 根目录 `tsconfig.base.json` + 各包继承的 `tsconfig.json`

**Rationale**:
- 统一 `compilerOptions`（target, module, strict 等）
- 各包可按需覆盖（如 React 项目需要 `"jsx": "react-jsx"`）
- `paths` 配置统一在 base 中管理

### 6. ESLint + Prettier 策略

**Decision**: 根目录统一配置 + 各包继承，使用 ESLint flat config (eslint.config.mjs)

**Rationale**:
- ESLint 9.x 默认使用 flat config，旧 `.eslintrc` 格式已弃用
- 根目录配置覆盖通用规则（TypeScript、import 排序等）
- 各包可追加框架特定规则（React、NestJS 等）

### 7. Husky + lint-staged 策略

**Decision**: Husky 9.x + lint-staged 15.x，仅检查暂存文件

**Rationale**:
- Husky 9.x 使用原生 Git hooks（不再依赖 `package.json` 的 `husky` 配置）
- lint-staged 确保 pre-commit 只检查变更文件，5 秒内完成
- Commitlint 确保 commit message 符合 Conventional Commits 规范

### 8. AI 服务（Python）集成策略

**Decision**: Python 项目独立管理依赖（uv/pip），通过根 `package.json` 脚本桥接调用

**Rationale**:
- Python 项目无法纳入 pnpm workspace，但需要统一的开发体验
- 在根 `package.json` 中定义 `"ai:dev"`, `"ai:build"` 等脚本桥接
- Turborepo 可通过 `turbo.json` 中的任务配置调度 Python 项目

### 9. CI/CD 策略

**Decision**: GitHub Actions，单 workflow 多 job，包含 lint / typecheck / build

**Rationale**:
- 设置 `fetch-depth: 0` 以支持 Turborepo affected 模式（后续阶段使用）
- `pnpm install --frozen-lockfile` 确保 CI 依赖与 lockfile 完全一致
- 使用 `pnpm/action-setup@v4` 自动处理 pnpm 缓存
- 预留远程缓存环境变量（`TURBO_TOKEN`, `TURBO_TEAM`）供后续启用

### 10. 小程序框架版本

**Decision**: Taro 4.x + React + TypeScript

**Rationale**:
- Taro 4.x 是最新主版本，支持 React 18 + TypeScript 5.x
- Taro 4.x 改进了编译性能和小程序兼容性
- 与 Web 端共享 React 技术栈，降低学习成本
- 项目文档中写的是 Taro 3.x，但 4.x 是当前稳定版，应使用最新版
