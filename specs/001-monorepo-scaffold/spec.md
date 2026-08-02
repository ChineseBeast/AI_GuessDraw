# Feature Specification: Monorepo 脚手架搭建

**Feature Branch**: `001-monorepo-scaffold`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "搭建你画我猜AI项目的 Monorepo 脚手架，使用 Turborepo + pnpm 管理多包仓库，包含 Web 前端、小程序前端、后端服务、AI 服务四个子包，配置共享类型、ESLint、Prettier、TypeScript 和 CI/CD 基础流水线。"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Monorepo 基础仓库初始化 (Priority: P1)

开发者需要在统一的 Monorepo 仓库中进行多包开发，包括 Web 前端 (React + Vite)、小程序前端 (Taro)、后端服务 (NestJS) 和 AI 服务 (FastAPI) 四个独立包，共享公共类型和工具。

**Why this priority**: 这是整个项目的基石，所有后续开发任务（M2-M7）都依赖此脚手架完成才能开始工作。

**Independent Test**: 可通过 `pnpm install && pnpm build` 验证所有包能正确安装依赖和构建。

**Acceptance Scenarios**:

1. **Given** 空仓库，**When** 执行 `pnpm install`，**Then** 所有子包依赖安装成功，无错误
2. **Given** 已安装依赖，**When** 执行 `pnpm build`，**Then** 所有子包构建成功，生成产物
3. **Given** 已构建，**When** 执行 `pnpm lint`，**Then** 所有子包通过 ESLint 检查

---

### User Story 2 - 共享包配置 (Priority: P1)

开发者需要在 `packages/shared/` 中定义跨包共享的 TypeScript 类型定义、工具函数和常量，确保 Web 端和小程序端使用一致的数据结构和业务逻辑。

**Why this priority**: 共享包是跨平台一致性的核心保障，必须在其他包开发前完成。

**Independent Test**: 可通过在其他包中 import shared 包的类型和工具来验证。

**Acceptance Scenarios**:

1. **Given** shared 包已配置，**When** Web 端 import `@draw-guess/shared` 的类型，**Then** TypeScript 类型检查通过
2. **Given** shared 包已配置，**When** 小程序端 import 共享工具函数，**Then** 编译通过且行为一致

---

### User Story 3 - 代码规范与质量保障 (Priority: P1)

开发者需要统一的代码规范配置（ESLint + Prettier + Commitlint）和 Git Hooks（Husky + lint-staged），确保全团队代码风格一致。

**Why this priority**: 代码规范是多人协作的基础，必须在任何功能代码提交前就位。

**Independent Test**: 可通过提交不规范代码触发 pre-commit hook 拒绝来验证。

**Acceptance Scenarios**:

1. **Given** 已配置 lint-staged，**When** 提交包含 lint 错误的代码，**Then** pre-commit hook 阻止提交并报错
2. **Given** 已配置 Commitlint，**When** 提交不规范格式的 commit message，**Then** commit-msg hook 阻止提交
3. **Given** 已配置 Prettier，**When** 保存代码文件，**Then** IDE 自动格式化代码

---

### User Story 4 - CI/CD 基础流水线 (Priority: P2)

开发者需要 GitHub Actions 基础流水线，在每次 Push 和 PR 时自动执行代码检查（Lint + TypeScript 类型检查 + 构建验证）。

**Why this priority**: CI/CD 是质量保障的第二道防线，在 M0 阶段完成可支撑后续所有开发。

**Independent Test**: 可通过推送到 GitHub 后观察 Actions 运行结果来验证。

**Acceptance Scenarios**:

1. **Given** CI 流水线已配置，**When** 向 develop 分支提交 PR，**Then** 自动触发 Lint + Type Check + Build 检查
2. **Given** CI 检查失败，**When** 查看 PR，**Then** 显示具体的失败原因和文件

---

### Edge Cases

- 当 `pnpm` 版本不兼容时，通过 `package.json` 中的 `engines` 字段和 `.npmrc` 锁定版本
- 当子包之间有循环依赖时，Turborepo 的 `dependsOn` 配置应能检测并报错
- 当 Windows/Mac/Linux 开发者使用不同系统时，所有脚本和路径使用跨平台兼容写法
- 当 shared 包修改后，依赖它的子包应能自动检测到变更（Turborepo 缓存失效）

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST 使用 Turborepo + pnpm workspace 管理 Monorepo，根目录包含 `pnpm-workspace.yaml` 和 `turbo.json`
- **FR-002**: System MUST 包含 `packages/web/` 子包，使用 React 18 + TypeScript 5.x + Vite 5.x，支持 HMR 开发模式
- **FR-003**: System MUST 包含 `packages/miniprogram/` 子包，使用 Taro 3.x + TypeScript 5.x
- **FR-004**: System MUST 包含 `packages/server/` 子包，使用 NestJS 10.x + TypeScript 5.x
- **FR-005**: System MUST 包含 `packages/ai-service/` 子包，使用 Python 3.11+ + FastAPI 0.100+
- **FR-006**: System MUST 包含 `packages/shared/` 共享包，提供公共 TypeScript 类型、工具函数和常量
- **FR-007**: System MUST 配置根目录 ESLint、Prettier、EditorConfig，所有子包继承根配置
- **FR-008**: System MUST 配置 Husky + lint-staged + Commitlint，确保 pre-commit 自动检查和 commit message 规范
- **FR-009**: System MUST 在根 `package.json` 中定义统一脚本：`dev`, `build`, `lint`, `lint:fix`, `typecheck`, `clean`
- **FR-010**: System MUST 配置 GitHub Actions CI 流水线，包含 Lint、Type Check、Build 三个 Job
- **FR-011**: System MUST 在 `.npmrc` 中配置 `shamefully-hoist=true` 和 `strict-peer-dependencies=false`
- **FR-012**: System MUST 在 `.gitignore` 中忽略 `node_modules/`, `dist/`, `build/`, `.env*`, `.turbo/`, `*.log`

### Key Entities

- **Monorepo 仓库**: 项目根目录，包含 Turborepo 配置、pnpm workspace 配置、全局脚本
- **Web 包 (packages/web)**: React + Vite + TypeScript Web 前端项目
- **小程序包 (packages/miniprogram)**: Taro + TypeScript 微信小程序项目
- **后端包 (packages/server)**: NestJS + TypeScript REST API 服务
- **AI 服务包 (packages/ai-service)**: Python FastAPI AI 推理服务
- **共享包 (packages/shared)**: 跨包共享的 TypeScript 类型、工具、常量
- **CI/CD 流水线**: GitHub Actions workflow 文件

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 新开发者从 clone 仓库到完成 `pnpm install && pnpm build` 全流程不超过 5 分钟
- **SC-002**: 所有子包的 `pnpm build` 在首次构建后，Turborepo 缓存命中时二次构建不超过 10 秒
- **SC-003**: `pnpm lint` 覆盖所有子包，0 错误通过
- **SC-004**: CI 流水线从 Push 到完成检查不超过 3 分钟
- **SC-005**: Pre-commit hook 执行时间不超过 5 秒（lint-staged 仅检查变更文件）
- **SC-006**: 子包之间 `import` 共享类型时，TypeScript 类型检查 0 错误

## Assumptions

- 开发环境已安装 Node.js 22.x、pnpm 8.x+、Python 3.11+
- 团队成员使用 VS Code 作为主力编辑器，配置 `.vscode/settings.json` 和推荐扩展
- GitHub Actions 有足够的免费额度支持 CI 运行
- Taro 项目后续需要微信开发者工具配合，但脚手架阶段仅保证编译通过
- AI 服务 Python 项目使用 `uv` 或 `pip` 管理依赖，不在 pnpm workspace 范围内，但通过 Turborepo 的 `package.json` 脚本统一调度
- 小程序分包配置在后续 M3 任务中细化，脚手架阶段仅搭建基础 Taro 项目
