# Tasks: 用户系统

**Feature**: 005-user-auth | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Backend Auth Module

- [x] T001 Install @nestjs/jwt, @nestjs/passport, passport, passport-jwt, bcrypt, @types/passport-jwt
- [x] T002 Create `apps/server/src/modules/auth/auth.types.ts`
- [x] T003 Create `apps/server/src/modules/auth/auth.service.ts` — register, login, validateUser, in-memory store
- [x] T004 Create `apps/server/src/modules/auth/strategies/jwt.strategy.ts` — Passport JWT
- [x] T005 Create `apps/server/src/modules/auth/guards/jwt-auth.guard.ts`
- [x] T006 Create `apps/server/src/modules/auth/auth.controller.ts` — POST register, login, GET me
- [x] T007 Create `apps/server/src/modules/auth/auth.module.ts` — register with JwtModule
- [x] T008 Register AuthModule in AppModule
- [x] T009 Apply JWT Guard to protected endpoints (leaderboard submit)

## Phase 2: WebSocket Auth

- [x] T010 Create `apps/server/src/gateway/ws-auth.guard.ts` — Socket.IO middleware JWT check
- [x] T011 Wire WS auth guard into RoomGateway (extract userId from token)
- [x] T012 Update room-manager.service.ts to use authenticated userId instead of socket handshake auth

## Phase 3: Frontend Auth UI

- [x] T013 Create `apps/web/src/services/auth.service.ts` — API client + Token localStorage management
- [x] T014 Create `apps/web/src/hooks/useAuth.ts` — auth state (user, isAuthenticated, login, register, logout)
- [x] T015 Create `apps/web/src/pages/auth/login.tsx` — login form with validation
- [x] T016 Create `apps/web/src/pages/auth/register.tsx` — register form with validation
- [x] T017 Create `apps/web/src/pages/auth/index.ts` — barrel export

## Phase 4: Integration

- [x] T018 Update main.tsx — add auth pages, protect multiplayer/leaderboard behind login
- [x] T019 Implement guest mode — allow singleplayer without login
- [x] T020 Wire JWT token into WebSocket connection (socket.io auth.token)
- [x] T021 Wire JWT token into leaderboard API calls

## Phase 5: Verification

- [x] T022 Verify lint: `pnpm lint` ✅
- [x] T023 Verify typecheck: `pnpm typecheck` ✅
- [x] T024 Verify build: `pnpm build` ✅

---

**Total tasks**: 24 (T001-T024) | **Completed**: 24 ✅
