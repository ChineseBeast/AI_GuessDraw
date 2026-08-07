# Research: WebSocket 房间管理系统

**Feature**: 002-websocket-room | **Date**: 2026-08-02

## 技术决策

### RD-001: WebSocket 框架 — Socket.IO

**决策**: 使用 Socket.IO（服务端 `@nestjs/websockets` + `@socket.io/socket.io`，客户端 `socket.io-client`）

**理由**:
- NestJS 原生支持 Socket.IO 作为 WebSocket 适配器（`@nestjs/websockets`）
- Socket.IO 内置断线重连、房间（Room）概念、广播、命名空间
- 自动降级：WebSocket 不可用时回退到 HTTP 长轮询
- 社区活跃、文档完善、生态成熟

**替代方案**:
- 原生 WebSocket（`ws` 库）：更轻量但缺少房间管理、重连机制，需自行实现
- SSE（Server-Sent Events）：单向推送，不适用于双向实时通信
- Centrifugo：独立服务，增加运维复杂度，V1 不需要

---

### RD-002: 房间状态存储 — 内存 Map + 后续迁移 Redis

**决策**: V1 使用 Node.js 内存 `Map<roomId, RoomState>` 存储房间状态

**理由**:
- V1 单实例部署，无需分布式状态共享
- 内存读写延迟 < 1ms，满足实时性要求
- 减少外部依赖，降低开发复杂度
- 通过清晰的接口抽象（`RoomRepository`），后续可无缝迁移到 Redis

**替代方案**:
- 直接使用 Redis：增加运维成本，V1 过早优化
- SQLite/PostgreSQL：磁盘 I/O 延迟不适合实时房间状态

**迁移路径**: V2 将 `RoomRepository` 实现从内存切换为 Redis，接口不变

---

### RD-003: 邀请码生成策略 — nanoid (6位)

**决策**: 使用 `nanoid` 生成 6 位邀请码，字符集排除易混淆字符

**理由**:
- 6 位长度适合手动输入和口头传播
- 排除 `0/O/1/I/L` 后字符集为 30 个字符，组合数 30^6 ≈ 7.29 亿
- nanoid 碰撞概率极低（7.29 亿中碰撞需生成约 2.7 万个码，远超实际需求）
- 生成时检查唯一性（内存 O(1) 查询），碰撞则重新生成

**替代方案**:
- UUID：太长，不适合手动输入
- 自增数字：可预测，安全性差
- human-readable 词汇组合（如"happy-cat"）：输入不便，中文用户不友好

---

### RD-004: 游戏状态机设计

**决策**: 使用有限状态机管理游戏流程

```
waiting → countdown → playing → round_end → next_round → countdown → ...
                                              → game_end
```

每个状态转换通过 WebSocket 事件触发：
- `waiting → countdown`: 房主发送 `start_game`
- `countdown → playing`: 3 秒倒计时自动完成
- `playing → round_end`: 全员猜对 或 60 秒超时
- `round_end → next_round`: 自动过渡（3 秒展示结果后）
- `next_round → countdown`: 开始新轮次
- `round_end → game_end`: 所有轮次完成

**理由**: 状态机确保状态转换可预测、可测试，防止非法状态（如 waiting 状态下直接进入 playing）

---

### RD-005: 画布数据压缩策略

**决策**: 笔画坐标使用 Douglas-Peucker 算法简化路径点

**理由**:
- 原始笔画数据可能包含大量冗余坐标点（高刷新率采集）
- Douglas-Peucker 在保留形状特征的前提下可将点数减少 50-80%
- 减少 WebSocket 传输数据量，降低带宽和延迟
- 算法实现简单，客户端即可执行

**替代方案**:
- 不压缩：简单但可能导致网络拥塞
- delta 编码：更复杂，但压缩比更高（V2 可考虑）

---

### RD-006: 词汇库管理

**决策**: V1 使用静态 JSON 词库，按难度分类，服务端启动时加载到内存

**理由**:
- 词汇数据量小（< 10KB），无需数据库
- 服务端随机选取，保证公平性
- 易于扩展和维护

**词库结构**:
```json
{
  "easy": ["苹果", "太阳", "房子", ...],
  "medium": ["自行车", "金字塔", "彩虹", ...],
  "hard": ["蒙娜丽莎", "自由女神像", "黑洞", ...]
}
```

---

### RD-007: 猜词匹配算法

**决策**: 精确匹配 + 模糊匹配（编辑距离）

**理由**:
- 精确匹配：答案完全一致 → 直接判定正确
- 模糊匹配：编辑距离 ≤ 1（允许一个错字/多字/少字）→ 判定为"接近"，给予提示但不计分
- 字数提示：猜测文本长度 == 答案长度 → 返回"字数正确"
- 中文分词不做复杂语义匹配（AI 语义匹配留给 V2）

---

### RD-008: 断线检测与重连

**决策**: Socket.IO 内置 disconnect 事件 + 服务端心跳检测 + 30 秒重连窗口

**理由**:
- Socket.IO 自动检测断线（`disconnect` 事件）
- 服务端维护 `disconnectedPlayers: Map<playerId, timeoutId>`
- 30 秒内重连 → 恢复状态；超时 → 移除玩家
- 客户端重连时发送 `reconnect` 事件携带 session token

---

### RD-009: 消息序列号与有序性

**决策**: 每条广播消息附加递增序列号，客户端按序列号排序渲染

**理由**:
- WebSocket 不保证消息顺序（尤其在重连场景）
- 序列号让客户端能检测丢包（跳跃的序列号）和乱序
- 丢包不重传（画布场景下偶尔丢包可接受），但乱序必须排序

---

### RD-010: 测试策略

**决策**: 服务端单元测试（Jest）+ WebSocket 集成测试 + 前端组件测试（Vitest）

**理由**:
- 游戏逻辑（状态机、计分、猜词匹配）适合纯函数单元测试
- WebSocket 通信适合集成测试（使用 `socket.io-mock` 或实际连接测试）
- 前端画布同步逻辑适合组件测试
