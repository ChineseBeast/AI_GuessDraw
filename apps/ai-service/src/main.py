"""Draw & Guess AI Service 入口。

通过 sys.path 注入项目根目录（src 的上一级），确保无论以何种方式启动
（uvicorn src.main:app / python -m src.main / python src/main.py）
都能正确解析 `src.*` 绝对导入，不依赖当前工作目录。
"""

import logging
import sys
from pathlib import Path

# 项目根目录（apps/ai-service），优先加入 sys.path
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from dotenv import load_dotenv  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

# 配置应用日志（uvicorn 自身的日志独立配置，这里覆盖应用层 logger，
# 确保 minimax_service 等模块的 warning/error 能在服务端控制台输出，便于排查 503 等问题）
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    stream=sys.stderr,
)
logging.getLogger("ai_service").setLevel(logging.INFO)


# 先加载 .env，再 import 依赖配置的模块（config 在 import 时读取环境变量）
load_dotenv(_PROJECT_ROOT / ".env")
# 兼容：也尝试 cwd 下的 .env（覆盖从仓库根目录启动的场景）
load_dotenv(override=False)

from src.routers import ai  # noqa: E402  必须在 load_dotenv 之后导入


app = FastAPI(title="Draw & Guess AI Service", version="0.2.0")

# 允许前端跨域访问（NestJS server 转发场景下也允许 localhost:3000）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(ai.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "draw-guess-ai-service"}


@app.get("/api/v1/info")
async def service_info():
    return {
        "name": "Draw & Guess AI Service",
        "version": "0.2.0",
        "capabilities": ["recognition", "drawing", "story"],
    }


if __name__ == "__main__":
    # 直接运行 `python src/main.py` 时启动 uvicorn 服务，
    # 这样不依赖 cwd（sys.path 已在文件顶部注入），任意路径执行均可。
    import uvicorn

    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
