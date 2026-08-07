# Feature Specification: 用户系统

**Feature Branch**: `005-user-auth` | **Created**: 2026-08-02

**Input**: PRD 3.4 CM-001~CM-003

---

## 概述

实现用户注册/登录（用户名+密码）、JWT 鉴权、游客模式、WebSocket 连接认证。用户系统是所有需要持久化数据功能（排行榜、进度同步）的前置依赖。

---

## User Stories

### US1 — 用户注册与登录 (P0) 🎯 MVP

用户通过用户名+密码注册账号，之后用相同凭据登录。登录后获得 JWT Token，后续 API 请求携带 Token 进行身份验证。

**Acceptance**:
1. `POST /api/auth/register` 接收 username + password，返回用户信息 + JWT Token
2. `POST /api/auth/login` 接收 username + password，返回用户信息 + JWT Token
3. 重复用户名注册返回 409 Conflict
4. 错误密码登录返回 401 Unauthorized

### US2 — JWT 鉴权中间件 (P0)

所有需要认证的 API 端点通过 JWT Guard 验证 Token。未认证请求返回 401。WebSocket 连接在 handshake 阶段验证 Token。

**Acceptance**:
1. 无 Token 访问受保护端点 → 401
2. 过期 Token → 401
3. 有效 Token → 正常响应，req.user 包含用户信息
4. WebSocket 连接时传递 Token 作为 auth.token → 连接建立后 socket.data.userId 可用

### US3 — 游客模式 (P1)

未登录用户以游客身份使用单机模式。游客获得临时 ID，游戏数据不持久化。游客可随时升级为正式用户。

**Acceptance**:
1. 首页提供「游客体验」入口，无需登录直接进入单机模式
2. 游客的排行榜分数不提交

### US4 — 前端登录/注册页面 (P0)

提供登录和注册表单页面，表单校验，错误提示，成功后跳转首页。

**Acceptance**:
1. 登录表单：用户名 + 密码 + 提交按钮
2. 注册表单：用户名 + 密码 + 确认密码 + 提交按钮
3. 表单校验：空值检查、密码最小 6 位、确认密码一致
4. 登录/注册成功后存储 Token 到 localStorage，跳转首页

---

## Functional Requirements

| 编号 | 需求 | 优先级 |
|------|------|--------|
| AU-001 | `POST /api/auth/register` — 用户名+密码注册 | P0 |
| AU-002 | `POST /api/auth/login` — 用户名+密码登录 | P0 |
| AU-003 | `GET /api/auth/me` — 获取当前用户信息（需 JWT） | P0 |
| AU-004 | JWT Guard 保护 API 端点 | P0 |
| AU-005 | WebSocket Gateway 验证 JWT Token | P0 |
| AU-006 | 游客模式 — 前端生成临时 ID，单机模式可用 | P1 |
| AU-007 | 登录/注册页面 UI | P0 |
| AU-008 | Token 持久化（localStorage）+ 自动恢复 | P0 |

---

## Success Criteria

| 指标 | 目标 |
|------|------|
| 注册 API 响应时间 | < 500ms |
| 登录 API 响应时间 | < 300ms |
| JWT 验证开销 | < 5ms |
| 登录页面加载 | < 1s |
