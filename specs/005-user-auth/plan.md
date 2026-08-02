# Implementation Plan: 用户系统

**Branch**: `005-user-auth` | **Spec**: [spec.md](./spec.md)

---

## Summary

实现完整的用户认证系统：NestJS 后端（Auth Module + JWT Guard + WebSocket Guard）、React 前端（登录/注册页面 + Token 管理 + 游客模式）。

---

## Technical Context

- **JWT**: @nestjs/jwt + @nestjs/passport + passport-jwt
- **密码哈希**: bcrypt (已声明于 constitution)
- **Token 存储**: localStorage（前端）
- **WebSocket 认证**: Socket.IO middleware 验证 JWT

---

## Project Structure

```text
apps/server/src/
├── modules/
│   └── auth/
│       ├── auth.module.ts
│       ├── auth.controller.ts    # POST /api/auth/register, /login, GET /me
│       ├── auth.service.ts       # 注册/登录/验证业务逻辑
│       ├── auth.types.ts
│       ├── guards/
│       │   └── jwt-auth.guard.ts # HTTP JWT Guard
│       └── strategies/
│           └── jwt.strategy.ts   # Passport JWT Strategy
├── gateway/
│   └── ws-auth.guard.ts          # 🆕 WebSocket JWT Guard
└── app.module.ts                 # 注册 AuthModule

apps/web/src/
├── pages/
│   └── auth/
│       ├── login.tsx             # 登录页面
│       └── register.tsx          # 注册页面
├── services/
│   └── auth.service.ts           # 认证 API 客户端 + Token 管理
├── hooks/
│   └── useAuth.ts                # 认证状态 hook
└── main.tsx                      # 集成登录流程
```

---

## Key Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 认证方案 | JWT (Access Token 24h) | Constitution 要求，无状态，适合 WebSocket |
| 密码存储 | bcrypt (10 rounds) | Constitution 要求 |
| 用户存储 | 内存 Map（V1） | 与现有架构一致，接口可迁移至 DB |
| WebSocket 认证 | Socket.IO middleware | 连接建立时验证，避免每条消息验证 |
| 游客模式 | 前端生成 UUID + 不持久化 | 简单实现，无需后端支持 |
