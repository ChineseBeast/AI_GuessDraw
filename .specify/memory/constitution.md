# 你画我猜AI Constitution

<!--
  Sync Impact Report
  ===================
  Version change: N/A → 1.0.0 (initial)
  Added sections: Core Principles, Security & Privacy, Development Workflow, Governance
  Removed sections: None
  Follow-up TODOs: None
-->

## Core Principles

### I. Spec-First Development (NON-NEGOTIABLE)

所有功能开发必须遵循 SpecKit 规范驱动流程：
- 先编写 Spec 文件（spec.md），定义 WHAT 和 WHY
- 再编写 Plan 文件（plan.md），定义 HOW
- 基于 Plan 生成 Tasks（tasks.md）
- 按 Tasks 执行 Implement
- 禁止跳过任何环节直接编码

### II. 用户价值优先

每个功能交付必须以用户故事为组织单位：
- 每个用户故事独立可测试、可交付
- P0 功能优先于 P1/P2 功能
- MVP 必须覆盖核心用户旅程
- 验收标准必须在开发前明确定义

### III. 跨平台一致性

Web 端和小程序端必须保持体验一致：
- 共享类型定义和业务逻辑（packages/shared/）
- 统一的数据模型和 API 接口
- 设计规范统一（色板、字体、组件）
- 差异仅限平台特有交互

### IV. AI 服务质量

AI 服务是产品核心竞争力，必须满足：
- AI 识别响应时间 < 3 秒（P95）
- AI 绘画生成时间 < 5 秒（P95）
- 识别准确率 > 60%
- 服务不可用时提供降级方案和友好提示

### V. 实时通信可靠性

联机模式依赖 WebSocket 实时通信：
- 画布同步延迟 < 100ms
- 断线重连 30 秒内恢复状态
- 房间状态一致性保证
- 并发房间数 > 500

## Security & Privacy

- 所有用户数据传输必须使用 HTTPS/WSS 加密
- 用户密码存储必须使用 bcrypt/argon2 哈希
- JWT Token 过期时间不超过 24 小时
- 禁止在前端代码或公共仓库中硬编码密钥
- 画作图片存储需访问控制，禁止未授权访问
- 小程序端遵循微信隐私协议规范

## Development Workflow

- Git 分支策略：main → develop → feat/* / fix/* / spec/*
- Commit 遵循 Conventional Commits 规范
- PR 必须通过 CI 检查（Lint + Test + SpecKit Check）
- PR 至少 1 人 Review（架构变更需技术负责人审批）
- 代码合并使用 Squash Merge
- Pre-commit Hook 自动执行 lint-staged

## Governance

本 Constitution 是项目的最高治理文件：
- 所有开发实践必须符合 Constitution 原则
- Constitution 修订需要技术负责人审批
- 修订遵循语义化版本（MAJOR.MINOR.PATCH）
- 所有 PR 和 Code Review 需验证 Constitution 合规性
- 复杂度增加必须在 Plan 阶段说明理由

**Version**: 1.0.0 | **Ratified**: 2026-08-02 | **Last Amended**: 2026-08-02
