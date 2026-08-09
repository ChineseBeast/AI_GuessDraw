# Quickstart: 故事模式

## 启动

```bash
pnpm install
pnpm --filter @draw-guess/shared build
pnpm --filter @draw-guess/server dev
pnpm --filter @draw-guess/web dev
cd apps/ai-service
.venv/Scripts/python -m uvicorn src.main:app --reload --port 8000
```

## 手工验收

1. 打开 `http://localhost:5173`。
2. 点击“故事模式”。
3. 选择“奇幻森林”。
4. 确认出现第 1/3 章剧情、绘画任务和画布。
5. 空画布点击提交，确认出现阻止提示。
6. 画至少一笔并提交，确认出现分数、星级、反馈和剧情结果。
7. 点击继续，完成第 2、3 章。
8. 确认结局页展示总分和章节回顾。
9. 点击再玩一次，确认回到主题选择。

## 降级验收

1. 将 AI provider 密钥留空或临时停止外部网络。
2. 保持 FastAPI 服务运行。
3. 重复完整三章流程。
4. 确认评价返回且标记为“本地评审”，流程不中断。

## API 冒烟

```bash
curl -X POST http://localhost:3000/api/v1/stories/start \
  -H "Content-Type: application/json" \
  -d '{"theme":"fantasy","provider":"minimax"}'
```
