"""配置管理：从环境变量读取 AI 服务相关配置。"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """运行时配置（在 import 时一次性读取，main.py 会先 load_dotenv）。"""

    # 千问（OpenAI 兼容端点）—— 现有配置，沿用 MINIMAX_* 命名
    minimax_api_key: str
    minimax_base_url: str
    minimax_model: str
    # MiniMax（Anthropic 协议端点）—— 新增 provider
    minimax_anthropic_api_key: str
    minimax_anthropic_base_url: str
    minimax_anthropic_model: str


def _load() -> Settings:
    return Settings(
        minimax_api_key=os.getenv("MINIMAX_API_KEY", ""),
        # 火山方舟 OpenAI 兼容端点（亦可配置为 MiniMax 官方 https://api.minimaxi.com/v1）
        minimax_base_url=os.getenv(
            "MINIMAX_BASE_URL", "https://ark.cn-beijing.volces.com/api/coding/v3"
        ),
        minimax_model=os.getenv("MINIMAX_MODEL", "minimax-m3"),
        # MiniMax Anthropic 兼容端点
        minimax_anthropic_api_key=os.getenv("MINIMAX_ANTHROPIC_API_KEY", ""),
        minimax_anthropic_base_url=os.getenv(
            "MINIMAX_ANTHROPIC_BASE_URL", "https://api.minimaxi.com/anthropic"
        ),
        minimax_anthropic_model=os.getenv("MINIMAX_ANTHROPIC_MODEL", "MiniMax-M3"),
    )


settings = _load()
