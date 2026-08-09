# Research: 故事模式

## R1 — 玩法结构

**Decision**: 使用固定三章、绘画驱动的分支冒险。

**Rationale**: 三章足以形成开始、发展、结局，能在一次短会话内完成，也便于稳定验收。分支通过每章评价的 `branchType` 和 `nextNarrative` 表达，不构建指数增长的剧情树。

**Alternatives considered**:

- 无限生成：成本、延迟和上下文管理过重，不适合 MVP。
- 纯文字选择：无法体现项目核心绘画能力。
- 完整剧情树：内容数量随章节指数增长，当前阶段维护成本过高。

## R2 — AI 与降级策略

**Decision**: 故事骨架使用可预测的本地模板；画作评价优先复用现有视觉识别服务，并将识别结果映射为评分与分支。模型异常时使用图片有效性与完成度启发式评分。

**Rationale**: 保证本地环境、无密钥环境和 CI 都可完成三章流程，同时在有模型时保留 AI 识别价值。

**Alternatives considered**:

- 所有剧情均实时调用大模型：延迟高且模型失败会阻断核心流程。
- 完全随机评分：缺少可解释性，无法稳定测试。
- 直接从浏览器调用模型：会泄露密钥并违反服务端代理约束。

## R3 — 服务边界

**Decision**: Web 仅调用 NestJS；NestJS 管理故事会话与章节顺序；FastAPI 负责故事内容生成和画作评价。

**Rationale**: 与现有单机模式的 `Web → NestJS → FastAPI` 路径一致，服务职责清晰，并避免前端持有敏感配置。

## R4 — 存储

**Decision**: NestJS 使用进程内 `Map<string, StoryProgress>`。

**Rationale**: 当前用户、房间和排行榜也以进程内存为主；MVP 不引入数据库可以控制范围。进度 GET 接口为后续持久化迁移提供稳定契约。

## R5 — 画布复用

**Decision**: 复用 `@draw-guess/ui` Canvas，通过 `CanvasRef.getImageDataURL()` 提交 PNG，通过工具状态提供颜色、粗细、撤销、重做和清空。

**Rationale**: 保持单机、联机、故事模式的绘画手感一致，符合跨平台共享原则。

## R6 — 评分模型

**Decision**: 评分范围 0-100；80-100 为 3 星/positive，60-79 为 2 星/neutral，0-59 为 1 星/alternative。

**Rationale**: 规则直观、可测试，且 alternative 不是失败状态，避免儿童用户因画得不像而无法推进。
