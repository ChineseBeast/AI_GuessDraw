---
name: speckit
description: Run GitHub Spec Kit's spec-driven development workflow — Specify → Plan → Tasks → Implement → Analyze. Use this skill whenever the user wants to (1) develop a feature using Spec Kit / spec-driven methodology, (2) invoke /speckit.* style commands (specify, plan, tasks, implement, analyze, checklist, constitution), (3) write a `spec.md`, `plan.md`, or `tasks.md` in the standard Spec Kit layout under `specs/<feature>/`, (4) say "用 speckit", "spec-driven", "规格驱动", "用 Spec Kit 写", "走一下 spec 流程", "从 spec 开始做", or (5) wants a feature decomposed into separate what/why/how artifacts rather than one monolithic PRD. Triggers on speckit/spec/规格/specify/plan/tasks/implement/constitution/analyze when the context is feature development, not just any spec doc. Mirrors the user's language in output.
---

# Spec Kit Workflow

This skill drives the **Spec Kit** spec-driven development methodology. Spec Kit's core idea: **separate what/why (spec) from how (plan) from execution (tasks)**. The user gives you a feature idea; you produce three artifacts in sequence, each tighter than the last, before any code is written.

The skill prefers to invoke Spec Kit's actual slash commands when they exist in the project (`.claude/commands/speckit.*.md` or `/.specify/...`). When they don't, it produces the same artifacts by hand in the canonical Spec Kit layout.

---

## 0. Detect the environment

Before doing anything, figure out which mode to run in:

```bash
ls .claude/commands/ 2>/dev/null | grep -i speckit
ls .specify/ 2>/dev/null
ls specs/ 2>/dev/null
```

- **Mode A — Full Spec Kit available**: project has `.claude/commands/speckit.*.md` or `.specify/` directory. Use the slash commands directly (`/speckit.specify`, `/speckit.plan`, etc.). This skill orchestrates *when* to invoke them and *what* to feed them.
- **Mode B — Bare repo, no Spec Kit installed**: produce the spec.md / plan.md / tasks.md files by hand in the Spec Kit layout under `specs/<NNN-slug>/`. Tell the user they can `pip install specify-cli` or run `uvx --from git+https://github.com/github/spec-kit specify init .` to get the real commands.
- **Mode C — User explicitly wants a single artifact only** (e.g. "just write the spec, don't plan it"): respect that. Don't force the full pipeline.

Default = Mode A if available, otherwise Mode B. Always tell the user which mode you picked.

---

## 1. The pipeline (in order)

```
   ┌──────────────────────────────────────────────────────┐
   │  0. Constitution (once per repo, optional)            │
   │     → .specify/memory/constitution.md                │
   ├──────────────────────────────────────────────────────┤
   │  1. Specify  (what & why)                            │
   │     → specs/<NNN-slug>/spec.md                      │
   ├──────────────────────────────────────────────────────┤
   │  2. Clarify  (resolve [NEEDS CLARIFICATION] markers) │
   │     → inline edits to spec.md                        │
   ├──────────────────────────────────────────────────────┤
   │  3. Plan     (how — technical)                       │
   │     → specs/<NNN-slug>/plan.md                      │
   ├──────────────────────────────────────────────────────┤
   │  4. Tasks    (ordered, atomic, testable)             │
   │     → specs/<NNN-slug>/tasks.md                     │
   ├──────────────────────────────────────────────────────┤
   │  5. Analyze  (cross-artifact consistency check)      │
   │     → report only, no file written                   │
   ├──────────────────────────────────────────────────────┤
   │  6. Implement (only if user says "go" / "实现")        │
   │     → execute tasks in order, one at a time          │
   └──────────────────────────────────────────────────────┘
```

Stop at any step the user asks for. Never auto-advance past Tasks into Implement without explicit confirmation.

---

## 2. Step-by-step behavior

### Step 0 — Constitution (only if missing)

If `.specify/memory/constitution.md` doesn't exist, offer to create one. A constitution is a short list of **non-negotiable project principles** (5–10 items) that every spec/plan must respect. Examples:

- "Library code must be tested; PRs without tests are rejected."
- "All user-facing strings live in `i18n/`, never inline."
- "Breaking API changes require a major version bump and a migration guide."

Don't write a constitution unless the user wants one. If they do, keep it under 200 lines.

### Step 1 — Specify

Goal: capture **what** the user wants and **why**, in user-value terms, with **zero implementation details**.

Produce `specs/<NNN-slug>/spec.md`. The `NNN` is the next available 3-digit number in the existing `specs/` directory; `slug` is a kebab-case short name derived from the feature.

Structure (this is the Spec Kit spec.md format — match it):

```markdown
# Feature Specification: <Name>

**Feature Branch**: `NNN-slug`
**Created**: <date>
**Status**: Draft
**Input**: User description: "<verbatim user prompt>"

## User Scenarios & Testing *(mandatory)*

### Primary User Story
<One paragraph: as a <role>, I want <capability>, so that <value>.>

### Acceptance Scenarios
1. **Given** <precondition>, **When** <action>, **Then** <observable outcome>.
2. ...

### Edge Cases
- What happens when <boundary condition>?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST <observable behavior>.
- **FR-002**: ...

### Key Entities *(if data involved)*
- **<Entity>**: <key attributes and relationships>

## Success Criteria *(mandatory)*

- **SC-001**: <measurable outcome>
- **SC-002**: ...

## Assumptions
- <assumption 1>

## Out of Scope
- <explicitly excluded>

## Open Questions
- [NEEDS CLARIFICATION] <question 1>
- [NEEDS CLARIFICATION] <question 2>
```

**Hard rules for spec.md**:
- ❌ No technology choices (no "use React", "use Postgres", "use Redis")
- ❌ No file paths, class names, function names, package names
- ❌ No architecture diagrams
- ✅ Every requirement is testable as a user-observable behavior
- ✅ Every success criterion has a number
- ✅ Mark anything you couldn't decide as `[NEEDS CLARIFICATION]`

### Step 2 — Clarify

Before planning, walk the user through every `[NEEDS CLARIFICATION]` marker. Ask them in a single batched message, not one at a time. Update spec.md in place; don't rewrite. Each resolution should land as a concrete FR or Assumptions entry.

If the user says "skip clarifications, just plan", drop the markers into the Open Questions section with a note that they remain unresolved.

### Step 3 — Plan

Goal: capture **how** the feature will be built. This is the only artifact where implementation details belong.

Produce `specs/<NNN-slug>/plan.md`. Structure:

```markdown
# Implementation Plan: <Name>

**Branch**: `NNN-slug`  •  **Spec**: [spec.md](./spec.md)

## Summary
<2-3 sentence technical approach>

## Technical Context
- **Language/Runtime**: 
- **Key Dependencies**: 
- **Storage**: 
- **Testing**: 
- **Target Platform**: 
- **Performance Goals**: <from spec SC-* items>
- **Constraints**: <from constitution + spec>

## Constitution Check
*Re-check against `.specify/memory/constitution.md`. Mark any violations.*

- [ ] Principle 1: <PASS | VIOLATION — explain>
- [ ] ...

## Design

### Architecture Overview
<ASCII or mermaid diagram, 1-2 levels deep>

### Components
- **<Component>** — <responsibility>. Interface: <inputs/outputs>. Owned by: <role>.

### Data Model
<Entity-relationship summary or schema sketch>

### API Surface
- `POST /path` — <purpose>, request/response shapes, error codes.

## Implementation Strategy

### Phase 1: <name>
<high-level approach, key files to touch, sequencing>

### Phase 2: <name>
...

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ...  | M          | H      | ...        |

## Open Questions (technical)
- <questions surfaced while planning that the user must decide before tasks>
```

**Hard rules for plan.md**:
- Every tech choice must trace back to either a spec FR/SC or a constitution principle. No "I picked X because I like it."
- If a choice has alternatives, list 2–3 in a brief "Alternatives considered" subsection before settling.
- "Constitution Check" is mandatory — even if the section is empty, the heading must be there.

### Step 4 — Tasks

Goal: an **ordered, dependency-aware checklist** of atomic work items that, when checked off, complete the plan.

Produce `specs/<NNN-slug>/tasks.md`. Structure:

```markdown
# Tasks: <Name>

**Input**: [plan.md](./plan.md), [spec.md](./spec.md)
**Branch**: `NNN-slug`

## Format
- Every task has an ID like `T001`
- `[ ]` = not started, `[x]` = done (you edit when implementing)
- Tasks are ordered; dependencies are explicit
- Each task should be completable in 0.5–2 days

---

## Phase 1: Setup

- [ ] T001 Create directory structure per plan §<section>
- [ ] T002 Add dependencies: <pkg@version>
- [ ] T003 ...

## Phase 2: Core Implementation

- [ ] T004 Implement <component> per plan §Components
  - **Files**: <paths>
  - **Acceptance**: <test or manual check>
  - **Depends on**: T001, T002
- [ ] T005 ...

## Phase 3: Integration

- [ ] T010 Wire <component A> to <component B>
  - **Acceptance**: end-to-end test from spec SC-001 passes
  - **Depends on**: T004, T005

## Phase 4: Polish

- [ ] T015 Add error paths per spec FR-007
- [ ] T016 Update docs/README

---

## Cross-Phase Dependencies
T004 → T010 (blocking)
T005 → T010 (blocking)

## Critical Path
T001 → T002 → T004 → T010 → T015

## Out of Scope (deferred)
- <things that came up but won't be done in this branch>
```

**Hard rules for tasks.md**:
- No vague verbs ("refactor", "improve", "clean up") without a specific deliverable. "Refactor X to extract Y" is fine; "refactor for clarity" is not.
- Every task links to either a spec FR or a plan section. If it doesn't, it doesn't belong here.
- Order = execution order, not priority. Use phase headers for grouping; use a separate "Out of Scope" list for what you're not doing.

### Step 5 — Analyze

Cross-artifact consistency check. Produce a short report (don't write to a file unless the user asks):

```
ANALYSIS REPORT
===============
Spec → Plan coverage:     X/Y FRs covered (list missing)
Plan → Tasks coverage:    X/Y components have tasks (list missing)
Constitution compliance:  X/Y principles satisfied (list violations)
Success criteria coverage: each SC-* mapped to ≥1 task
Internal consistency:     no contradictions found | <list contradictions>

Verdict: READY TO IMPLEMENT | NEEDS FIXES — <summary>
```

If verdict is NEEDS FIXES, list each issue with the file:line to fix. Don't fix without asking.

### Step 6 — Implement

Only runs when the user says "go" / "实现" / "implement" / "开干".

- Take tasks.md as the source of truth. Mark `[x]` only after the task's acceptance check passes.
- One task at a time. After each, show a 1-line diff summary.
- If a task reveals missing info or a spec gap, STOP and surface it. Don't silently change the spec.
- Never batch-update tasks.md to claim multiple tasks done without evidence.

---

## 3. Slash command mapping (Mode A)

When the project has Spec Kit's slash commands, your job is to **invoke them in order with the right input**, not to recreate their output.

| Stage       | Slash command      | What to pass                                  |
|-------------|--------------------|-----------------------------------------------|
| Specify     | `/speckit.specify` | The user's verbatim feature description       |
| Clarify     | (manual)           | Walk through [NEEDS CLARIFICATION] markers    |
| Plan        | `/speckit.plan`    | Reference to the spec.md path                 |
| Tasks       | `/speckit.tasks`   | Reference to the plan.md path                 |
| Analyze     | `/speckit.analyze` | Reference to all three artifacts              |
| Checklist   | `/speckit.checklist` | Quality dimension name (e.g. "ux", "security") |
| Constitution| `/speckit.constitution` | (one-time setup)                         |
| Implement   | `/speckit.implement` | "next task" / "task T007" / "all"           |

If the slash commands aren't registered, fall back to Mode B silently and tell the user.

---

## 4. Interaction style

- **Mirror the user's language** for prose inside artifacts. Code/IDs stay English.
- **Batch clarifications** — one message, all questions, numbered.
- **Don't dump the full file in chat.** Write the file; in chat show only the heading + first 3 lines + acceptance scenarios, then say "full spec at specs/NNN-slug/spec.md".
- **Confirm at the gates**:
  - After spec.md draft → "Spec ready. Review? Or shall I proceed to plan?"
  - After plan.md draft → "Plan ready. Any tech-choice pushback before I generate tasks?"
  - After tasks.md draft → "Tasks ready. Shall I analyze, or jump to implement?"
- **Never skip the Constitution Check** in plan.md. Even if the constitution is empty, the section must exist with `<no constitution defined>` and all items marked N/A.
- **No "I'll just refactor this real quick"** during implement. Stick to tasks.md.

---

## 5. Quality gates (run before showing any artifact)

Before delivering each artifact, verify:

**spec.md**:
- [ ] Zero implementation details (no tech, file paths, class names)
- [ ] Every FR is user-observable behavior, not internal mechanism
- [ ] At least one acceptance scenario per primary user story
- [ ] At least 2 measurable success criteria
- [ ] Out-of-scope list is non-empty (or explicit "none yet")
- [ ] Open questions either resolved or marked `[NEEDS CLARIFICATION]`

**plan.md**:
- [ ] Constitution Check section exists and is filled
- [ ] Every tech choice traces to spec or constitution
- [ ] Alternatives considered for any non-trivial choice
- [ ] Risks table non-empty
- [ ] No spec FR is silently dropped

**tasks.md**:
- [ ] Every task has ID, acceptance check, and dependency notes
- [ ] No task is > 2 days of work (else split)
- [ ] Critical path identified
- [ ] Out-of-scope list non-empty
- [ ] Tasks are ordered, not prioritized

If any check fails, fix before showing the user.

---

## 6. What this skill does NOT do

- It does not write application code unless /speckit.implement is invoked.
- It does not pick technology without user buy-in for anything non-trivial — flag choices that need a decision.
- It does not silently expand scope. Anything new goes in Out of Scope or gets a new spec branch.
- It does not pretend the constitution is satisfied when it isn't.
