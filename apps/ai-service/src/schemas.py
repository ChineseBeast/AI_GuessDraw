"""请求/响应数据模型，字段命名与 packages/shared 的类型契约保持一致（camelCase）。"""

from pydantic import BaseModel, Field


class AIGuess(BaseModel):
    word: str
    confidence: float = Field(ge=0.0, le=1.0)


class RecognizeRequest(BaseModel):
    """对应 shared 的 AIRecognizeRequest。"""

    image: str  # Base64 PNG（含 data:image/png;base64, 前缀）
    targetWord: str
    difficulty: str  # 'easy' | 'medium' | 'hard'
    provider: str = "qwen"  # 'qwen'（OpenAI 兼容）| 'minimax'（Anthropic 协议）


class RecognizeResponse(BaseModel):
    """对应 shared 的 AIRecognizeResponse。"""

    guesses: list[AIGuess]
    isCorrect: bool
    matchedGuess: AIGuess | None = None
    processingTime: int


class AIDrawPoint(BaseModel):
    """对应 shared 的 AIDrawPoint。"""

    x: float
    y: float


class AIDrawStroke(BaseModel):
    """对应 shared 的 AIDrawStroke（绘画行为 = 一条笔画轨迹）。"""

    points: list[AIDrawPoint]
    color: str = "#000000"
    width: float = 4.0


class DrawRequest(BaseModel):
    """对应 shared 的 AIDrawRequest。"""

    targetWord: str
    difficulty: str  # 'easy' | 'medium' | 'hard'
    provider: str = "qwen"  # 'qwen'（OpenAI 兼容）| 'minimax'（Anthropic 协议）


class DrawResponse(BaseModel):
    """对应 shared 的 AIDrawResponse。"""

    strokes: list[AIDrawStroke]
    processingTime: int
