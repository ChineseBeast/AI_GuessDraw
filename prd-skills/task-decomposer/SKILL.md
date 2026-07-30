---
name: task-decomposer
description: Decompose complex tasks/projects into structured subtasks and write complete PRDs (Product Requirements Documents). Use this skill whenever the user wants to (1) break down a feature, project, or vague goal into actionable tasks, (2) write a PRD / 需求文档 / 产品需求 / 规格说明书, (3) scope a project, plan a sprint, or estimate work, (4) organize requirements into milestones, (5) ask "帮我拆解一下", "写个PRD", "需求拆解", "怎么把这个拆开", "plan this out", "scope this feature", "break this down", "write a spec for X". Triggers on 拆解/PRD/需求/任务分解/规划/排期/里程碑/分阶段/任务清单. Works in any language — mirrors the user's language in output.
---

# Task Decomposer & PRD Writer

This skill turns a fuzzy goal into **(a) a clear task breakdown** and **(b) a complete PRD**, in one or two passes. It is opinionated, structured, and biased toward *executable* output — every task should be small enough to pick up and finish.

The skill has two modes, run in this order unless the user asks for just one:

1. **Decompose** — break the goal into phases → tasks → subtasks with acceptance criteria, dependencies, and effort.
2. **Write the PRD** — fold the breakdown, plus context (background, goals/non-goals, requirements, risks, milestones), into a PRD document.

If the user only wants one of the two (e.g. "just decompose, no need for a doc"), skip the other.

---

## 0. Read the situation first

Before decomposing, decide how much clarification is needed. **Do not ask questions the user can answer trivially, and do not ask questions when reasonable defaults exist.** But also do not invent critical product decisions.

Heuristics:
- The user gave a concrete feature/project → clarify only what you cannot infer (target users? platform? hard deadline?).
- The user gave a one-liner like "做一下登录" → ask 2–4 sharp questions max: 登录方式? 目标平台? 是否需要第三方登录? 是否有已存在的账号体系?
- The user gave a huge dump (a long brief, a Notion link pasted in, a meeting transcript) → extract intent and surface contradictions instead of asking more.
- The user explicitly said "别问了,直接干" / "just do it" / "no questions" → skip clarification entirely, state your assumptions, and proceed.

When in doubt, ask. When the goal is clear, proceed. State assumptions explicitly in the PRD's "Open Questions / Assumptions" section so the user can correct them.

Mirror the user's language (Chinese in, Chinese out).

---

## 1. Decomposition

The output of decomposition is a tree:

```
Goal
└── Phase (里程碑 / 大阶段)
    └── Task (一个可指派、可估时、可验收的工作单元)
        └── Subtask (可选,只在任务明显复杂时再拆)
```

### Principles (apply ruthlessly)

- **MECE**: phases and tasks should be mutually exclusive and collectively exhaustive. If two tasks overlap, merge or split. If something is missing, add it.
- **Right-sized task**: a task should take **0.5 to 2 days for one person**. Smaller → merge. Larger → split. Use T-shirt sizes (S/M/L) or hours.
- **Every task has a deliverable + acceptance criteria**: "做完" is not a deliverable. "登录页 UI 完成,适配移动端,通过设计走查" is.
- **Explicit dependencies**: between tasks, between phases. Mark blocking relationships. Identify the **critical path**.
- **MUST / SHOULD / COULD**: tag each task. The user can re-prioritize.
- **Risks per task**: anything that could blow up the estimate (unknown tech, external dep, unclear requirement).
- **Parallelism**: flag tasks that can run in parallel (different owners, no dependency).
- **Verification built in**: for non-trivial tasks, include a "how we know it's done" line — test, manual check, metric, review.

### Decomposition process (run in your head, output the result)

1. **Goal restatement** — one sentence.
2. **Phases** — usually 3–6. Each phase has a clear exit criterion (e.g. "Phase 1 done = prototype demo'd to stakeholders"). Suggested phase shape: `Discovery → Design → Build → Test → Launch` or whatever fits the domain.
3. **Tasks per phase** — 3–10 each. Each task: title, description, owner role, effort (S/M/L or hours), MUST/SHOULD/COULD, dependencies (task IDs), acceptance criteria, risks.
4. **Critical path** — call out the longest dependency chain.
5. **First 3 tasks to start tomorrow** — give the user something concrete to act on immediately.

### Output format for decomposition

Present the tree in a readable way — tables for tasks, bullets for subtasks. Don't dump a 200-line JSON; humans skim.

Example task row:

| ID | Task | Owner | Effort | Priority | Depends on | Acceptance criteria | Risks |
|----|------|-------|--------|----------|------------|---------------------|-------|
| T1.2 | 实现 OAuth 登录回调 | 后端 | M | MUST | T1.1 | 回调通过端到端测试,错误码映射完整 | 第三方限流 |

---

## 2. PRD writing

A PRD written by this skill follows this structure. Adapt section names to the user's domain (e.g. "User Stories" might be "Use Cases" in B2B), but keep the substance.

```markdown
# PRD: <产品/功能名>

> <一句话目标 + 一句话非目标>

- **作者**: <user>  •  **最后更新**: <date>  •  **状态**: Draft / In Review / Approved
- **版本**: v0.1

## 1. 背景 / Context
<为什么做这个问题,现在做,不做会怎样。2-4 段。>

## 2. 目标 & 非目标
### 2.1 目标 (Goals)
- <可衡量的目标 1>
- <可衡量的目标 2>

### 2.2 非目标 (Non-Goals)
- 明确不做的事,避免范围蔓延

## 3. 用户与场景
### 3.1 目标用户
- <画像 1>
### 3.2 核心场景 / User Stories
- 作为 <角色>,我想要 <动作>,以便 <价值>。
  - 验收: <具体条件>

## 4. 需求
### 4.1 功能需求
- FR-1: <需求描述>
- FR-2: ...
### 4.2 非功能需求
- NFR-性能: ...
- NFR-安全: ...
- NFR-可用性: ...

## 5. 任务拆解
### 5.1 阶段划分
<分解的 phase 列表,每个 phase 写明入口/出口准则>
### 5.2 任务清单
<按 phase 组织的 task 表格,见 Decomposition 输出格式>
### 5.3 关键路径
<从起点到目标的最长依赖链,高亮>
### 5.4 优先级
<MUST / SHOULD / COULD 分布概览>

## 6. 依赖 & 风险
### 6.1 外部依赖
- <第三方服务/团队/审批/法律>
### 6.2 风险登记
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| ...  | 中   | 高   | ...      |

## 7. 里程碑 / Timeline
<时间盒 / 排期,按 phase 给出。给出 best case / likely / worst case。>

## 8. 度量 / 成功标准
- 上线后 X 天达到 Y 指标
- 核心指标: ...

## 9. 开放问题 & 假设
- [ ] <未决问题,需要 owner 决策>
- 假设: <做的假设,如果错了怎么办>

## 10. 附录
- 相关链接、原型、参考实现、数据
```

### PRD writing rules

- **Quantify**: "快" → "P95 < 200ms"。"很多人用" → "DAU 10k+"。
- **No fluff**: 删掉"打造业界领先"这类句子。
- **Testable**: 每条需求都能转成测试用例或人工验收步骤。
- **Traceable**: 每个 task 至少挂钩到一条 FR 或一条 NFR。
- **Honest non-goals**: 显式排除比模糊包含更有用。

---

## 3. Interaction style with the user

- **Be concise in chat, thorough in the doc.** Don't paste the full PRD into the terminal — write it to a file and summarize.
- **Default save location**: working directory. Default filename: `PRD-<slug>-<YYYYMMDD>.md` (slug = kebab-case short name). If a CLAUDE.md or repo convention says otherwise, follow it.
- **After writing the PRD**, give the user a 5-bullet summary: top 3 MUST-have tasks, biggest risk, the one decision they need to make next.
- **Iterate**: when the user says "把 Phase 2 拆细一点" or "加一个 NFR", update the doc in place, don't rewrite from scratch. Use Edit, not Write.
- **Don't fake certainty**: if a number is a guess, say "假设".

---

## 4. Quality checks before handing off

Run these in your head (or call them out) before delivering:

- [ ] 至少 2 个 non-goal 写出来了
- [ ] 每个 MUST task 都有 acceptance criteria
- [ ] 关键路径识别了
- [ ] 至少 1 个风险登记
- [ ] 开放问题列表非空(或者明确写了"无")
- [ ] 时间盒给出 best/likely/worst 三个数
- [ ] 文档里没有"打造""赋能""极致"这类空话
- [ ] 任务粒度:无 task > L (3+ days) 未拆分

If any check fails, fix it before showing the user.

---

## 5. What this skill does NOT do

- 不做技术选型(那是 architect 决策,可以在 PRD 里列选项让用户选)
- 不写代码、不写测试(那是后续 skill 的事)
- 不做资源/预算评估(让用户加,这里不编)
- 不假装懂用户的产品 — 该问就问,该假设就标
