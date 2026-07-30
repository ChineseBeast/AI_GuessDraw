---
name: prd-to-speckit
description: End-to-end automated development pipeline that takes a PRD (or a feature idea) and runs the full Spec Kit workflow to a working implementation. Bridges the `task-decomposer` and `speckit` skills. Use this skill when the user wants to (1) go from PRD/idea → working code without manual gating, (2) say "全自动化开发", "automate the whole thing", "从 PRD 一路做到实现", "跑一遍完整流程", "auto-dev", "从需求到代码", "PRD to code", (3) chain a PRD into the spec-driven development pipeline, (4) generate spec.md / plan.md / tasks.md AND start implementing, (5) run a no-touch build where each stage auto-advances. Defaults to full-auto with smart stop conditions; supports --review and --plan-only modes.
---

# PRD → Spec Kit → Code

This skill **chains the PRD and Spec Kit skills into one autonomous pipeline**. Input: a PRD, a feature description, or even a one-liner. Output: a complete `specs/<NNN-slug>/` directory plus a working implementation, with a human-readable run log.

```
┌─────────────────┐    ┌──────────────┐    ┌──────────────────────────────┐
│  Input          │ →  │  task-       │ →  │  speckit (Specify → Plan →   │
│  • PRD file     │    │  decomposer  │    │  Tasks → Analyze → Implement) │
│  • Feature idea │    │  (optional)  │    │                              │
│  • One-liner    │    └──────────────┘    └──────────────────────────────┘
└─────────────────┘
```

If input is already a PRD or feature brief, skip the `task-decomposer` step. If input is fuzzy ("做一个积分系统"), call it first.

---

## 0. Modes

The skill has three modes, chosen by flags or by what the user said:

| Mode | Flag / trigger | Behavior |
|------|----------------|----------|
| **Full-auto** | default; "全自动化", "auto", "go" | Run all stages, auto-resolve clarifications with marked assumptions, stop only on constitution violation or hard spec gap |
| **Review** | `--review`; "每步确认", "review mode" | Pause after each stage for user approval |
| **Plan-only** | `--plan-only`; "只到 plan", "先别实现" | Run Specify → Plan → Tasks → Analyze, then stop |

Detect the mode from the user's words; if ambiguous, default to **full-auto** but say so explicitly and offer to switch.

---

## 1. Inputs and how to handle them

Accepted inputs (in order of preference — pick the first match):

1. **Existing PRD file path** — e.g. `PRD-auth.md`, `./docs/reqs/payments.md`. Read it, extract goals + functional requirements + non-goals, treat as the seed for `specify`.
2. **Existing Spec Kit spec.md** — skip Specify, start from Plan. (User is re-running with a known spec.)
3. **Feature brief / one-liner** — call `task-decomposer` first to produce a PRD, then continue.
4. **Pointer to a previous session / pasted PRD text** — same as (1), read inline.

Mirror the user's language for prose, English for IDs/code.

---

## 2. The pipeline (full-auto default)

```
1. Ingest       — read PRD / brief, extract signal
2. Specify      → specs/<NNN-slug>/spec.md
3. Clarify      — auto-fill [NEEDS CLARIFICATION] with explicit assumptions
4. Plan         → specs/<NNN-slug>/plan.md
5. Constitution check — fail loud if violation
6. Tasks        → specs/<NNN-slug>/tasks.md
7. Analyze      — cross-artifact report, abort on NEEDS FIXES verdict
8. Implement    — execute tasks.md in order
9. Hand off     — summary + diff + next steps
```

Each stage writes a checkpoint to `dev-log.md` in the same directory. The log is the user's audit trail.

---

## 3. Stage-by-stage behavior

### 3.1 Ingest

Goal: turn the input into a **2-paragraph feature brief** (what + why) and a list of **candidate non-goals** lifted from the PRD's Non-Goals section or inferred from omissions.

If the input is a one-liner, expand it by asking **at most 3** sharp questions (target user? platform? hard deadline?) unless the user pre-declared "don't ask". The skill is opinionated: prefer asking to guessing on product-defining decisions; prefer guessing on technical decisions.

### 3.2 Specify

Run the `speckit` skill's Specify stage. Produce `specs/<NNN-slug>/spec.md` in the standard Spec Kit layout.

**Auto-fill rule (full-auto mode only)**: any decision that would otherwise become `[NEEDS CLARIFICATION]` is resolved with a **reasonable default** and recorded in spec.md under a new section:

```markdown
## Auto-Resolved Assumptions
*Decisions made automatically during full-auto run. Revert any of these and re-run if wrong.*

- A001: <decision> — <one-line rationale> — <how to override>
- A002: ...
```

Every auto-resolved decision must have:
- A unique ID (A001, A002, …)
- A one-line rationale
- A one-line override instruction ("set this to Y and re-run")

This makes the auto-resolution auditable and reversible.

### 3.3 Clarify

In full-auto: skipped (handled by §3.2 auto-fill). In review: surface all `[NEEDS CLARIFICATION]` markers in one batched message.

### 3.4 Plan

Run the `speckit` skill's Plan stage. Produce `specs/<NNN-slug>/plan.md`. Constitution Check section is **non-negotiable** — must be filled.

**Auto-resolve technical choices (full-auto)**:
- Framework / language: pick the project's dominant stack (read `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.). If none, pick the simplest fit and document.
- Storage: pick the lightest option that satisfies spec requirements (SQLite > Postgres for local-only, etc.). Document alternatives considered.
- Testing: match the project's existing test framework.
- API style: REST unless spec implies otherwise.

Each auto-picked technical choice goes in the Auto-Resolved Assumptions section of `plan.md` (parallel to spec.md).

### 3.5 Constitution check

If `.specify/memory/constitution.md` exists, run the check from the `speckit` skill.

**Hard stop conditions** (full-auto halts here, even without user review):
- Any principle is VIOLATED and the violation can't be resolved by a doc edit (i.e. it requires changing the spec itself)
- More than 2 principles violated in the same run

In those cases, write the violations into `dev-log.md` and **stop**, telling the user what to fix.

### 3.6 Tasks

Run the `speckit` skill's Tasks stage. Produce `specs/<NNN-slug>/tasks.md`. Critical path identified.

**Auto-task generation rules**:
- Always include: `T001` bootstrap (dir, deps, config), `T002` first test that fails, `TNNN` final integration test against spec SC-001.
- Each MUST task in the PRD becomes at least one task here. MUST → MUST, SHOULD → SHOULD, COULD → deferred to Out-of-Scope.
- Estimate per task. If a task > 2 days, split it automatically.

### 3.7 Analyze

Run the `speckit` skill's Analyze stage. Produce a report.

**Hard stop conditions** (full-auto halts here):
- Verdict = NEEDS FIXES
- Any FR in spec.md has no matching task
- Any constitution principle unaddressed

Fix attempts: if a fix is mechanical (typo, missing link), apply it. If it's a design decision, halt.

### 3.8 Implement

Run the `speckit` skill's Implement stage. Execute tasks in order.

**Full-auto implementation rules**:
- One task at a time. Mark `[x]` only after the task's acceptance check passes.
- Run the project's test suite after every task that adds or changes code. If red, fix the regression before moving on. After 3 failed fix attempts on the same task, halt.
- Commit per task with message format: `TNNN: <task title>` (use the user's preferred commit style if detectable from `git log`).
- Do not refactor unrelated code. Do not add features beyond the current task. If a gap appears, write it to `dev-log.md` as a discovered issue and continue only if non-blocking; otherwise halt.

**Hard stop conditions** (full-auto halts here):
- Test suite red after 3 fix attempts
- Spec gap discovered that would change a future task
- Constitution violation discovered mid-implementation
- User interrupts

### 3.9 Hand off

Write a `HANDOFF.md` at the project root with:
- 1-paragraph summary of what was built
- Path to spec.md / plan.md / tasks.md
- List of commits made
- Auto-resolved assumptions (A001…) with override instructions
- Discovered issues / deferred items
- Suggested next steps (3-5 bullets)

In chat, show only the 5-bullet summary. Don't paste the full HANDOFF.

---

## 4. dev-log.md format

Append a block per stage. Keeps the run auditable:

```markdown
# Dev Log: <NNN-slug>

## <ISO timestamp> — Stage: Ingest
- Input: <path or one-liner>
- Decisions: <key extractions>

## <timestamp> — Stage: Specify
- Output: specs/NNN-slug/spec.md
- FRs: <count>
- SCs: <count>
- Auto-resolved: A001, A002, …

## <timestamp> — Stage: Plan
- Output: specs/NNN-slug/plan.md
- Tech choices: <list with rationale pointers>
- Constitution: PASS / VIOLATION (details)

## <timestamp> — Stage: Tasks
- Output: specs/NNN-slug/tasks.md
- Total tasks: N (MUST / SHOULD / COULD)
- Critical path: T001 → T007 → T012

## <timestamp> — Stage: Analyze
- Verdict: READY TO IMPLEMENT | NEEDS FIXES
- Coverage: spec→plan X/Y, plan→tasks X/Y

## <timestamp> — Stage: Implement
- T001: ✅ <commit hash>
- T002: ✅ <hash>
- T003: ❌ halted — <reason>

## <timestamp> — Hand off
- HANDOFF.md written
- Next: <bullet>
```

---

## 5. Smart stop conditions (summary)

The pipeline halts when **any** of these are true, even in full-auto:

1. **No constitution compliance** — can't proceed without violating a project principle.
2. **Missing dependency** — needs a library, service, or decision the user must make.
3. **Test suite red 3x** on the same task — the task is harder than it looked; surface to user.
4. **Spec gap discovered mid-implement** — would change a future task; surface and stop.
5. **User interruption** — they typed something or sent a stop signal.

When halting:
- Update dev-log.md with the reason
- Write what was completed and what's left
- Do not retry automatically
- Tell the user clearly: what stopped, why, and what they need to decide

---

## 6. --review mode (gates)

In review mode, stop after each stage and ask: "OK to continue to <next stage>?". The user can also interject changes at any gate. The skill applies the change to the current artifact and re-runs the quality gate for that artifact before moving on.

Default gates in review mode:
- After Specify
- After Plan
- After Tasks
- (Analyze is read-only, no gate)
- (Implement gates per task in dev-log only — no chat interruption unless red)

---

## 7. --plan-only mode

Stop after Analyze. Do not start Implement. Deliver:
- spec.md, plan.md, tasks.md
- dev-log.md
- One-paragraph "ready to implement when you say go"

---

## 8. Composition with the other two skills

This skill **inherits** from `task-decomposer` and `speckit`. It does not duplicate their rules — it orchestrates them.

- If input is fuzzy → invoke `task-decomposer` (via its own slash command or its PRD template) to get a PRD-shaped intermediate.
- For every Spec Kit stage → invoke the matching behavior from the `speckit` skill, including its quality gates and hard rules.
- Never rewrite the spec/plan/task templates inline — defer to the `speckit` skill's canonical formats.

If a change is needed in the underlying skills, edit them — don't fork the rules here.

---

## 9. What this skill does NOT do

- It does not skip the Constitution Check, even in full-auto.
- It does not silently change the spec. If a gap is found mid-implement, it halts and surfaces.
- It does not produce HANDOFF.md as a wall of marketing copy. It's terse and factual.
- It does not run tasks out of order or in parallel by default. (Parallel is fine if plan.md explicitly groups independent tasks — but full-auto runs sequentially for predictability.)
- It does not commit on the user's main branch without explicit confirmation. Default: create `NNN-slug` branch.
