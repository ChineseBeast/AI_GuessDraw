# Quickstart: Monorepo 脚手架搭建

**Feature**: 001-monorepo-scaffold
**Date**: 2026-08-02

## 前置条件

- Node.js >= 22.14.0
- pnpm >= 10.8.0（通过 Corepack 管理）
- Python >= 3.11（仅 AI 服务需要）
- Git

## 快速开始

### 1. 克隆并初始化

```bash
git clone <repo-url> draw-guess-ai
cd draw-guess-ai

# Corepack 自动安装正确版本的 pnpm
corepack enable
pnpm --version  # 应输出 10.8.x
```

### 2. 安装依赖

```bash
pnpm install
```

预期: 所有 workspace 包的依赖安装成功，无错误。

### 3. 构建所有包

```bash
pnpm build
```

预期: 所有子包构建成功，Turborepo 显示每个包的构建状态。

### 4. 代码检查

```bash
pnpm lint        # ESLint 检查
pnpm typecheck   # TypeScript 类型检查
```

预期: 0 错误通过。

### 5. 启动开发模式

```bash
# 启动所有开发服务器
pnpm dev

# 或分别启动
pnpm --filter @draw-guess/web dev        # Web: http://localhost:5173
pnpm --filter @draw-guess/server dev     # API: http://localhost:3000
pnpm --filter draw-guess-ai-service dev  # AI: http://localhost:8000
```

### 6. 清理

```bash
pnpm clean
```

预期: 删除所有 `dist/`, `build/`, `.turbo/` 目录。

## 验证清单

- [ ] `pnpm install` 成功，无 peer dependency 警告
- [ ] `pnpm build` 所有包构建成功
- [ ] `pnpm lint` 0 错误
- [ ] `pnpm typecheck` 0 错误
- [ ] `git commit` 触发 pre-commit hook
- [ ] 不规范 commit message 被 commit-msg hook 拒绝
- [ ] VS Code 打开项目，ESLint + Prettier 扩展正常工作

## 常见问题

**Q: `pnpm install` 报 peer dependency 错误？**
A: 检查 `.npmrc` 中 `strict-peer-dependencies=false` 是否配置。

**Q: VS Code 中 ESLint 不生效？**
A: 确保安装了 ESLint 扩展，并在 `.vscode/settings.json` 中配置 `"eslint.useFlatConfig": true`。

**Q: Python AI 服务无法启动？**
A: 确保 Python 3.11+ 已安装，进入 `apps/ai-service/` 目录执行 `pip install -r requirements.txt`。
