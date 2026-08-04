"""配置管理：从环境变量读取 MiniMax 相关配置。"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """运行时配置（在 import 时一次性读取，main.py 会先 load_dotenv）。"""

    minimax_api_key: str
    minimax_base_url: str
    minimax_model: str


def _load() -> Settings:
    return Settings(
        minimax_api_key=os.getenv("MINIMAX_API_KEY", ""),
        # 火山方舟 OpenAI 兼容端点（亦可配置为 MiniMax 官方 https://api.minimaxi.com/v1）
        minimax_base_url=os.getenv(
            "MINIMAX_BASE_URL", "https://ark.cn-beijing.volces.com/api/coding/v3"
        ),
        minimax_model=os.getenv("MINIMAX_MODEL", "minimax-m3"),
    )


settings = _load()
