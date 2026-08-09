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


class RecognizeStroke(BaseModel):
    """联机画布同步笔画（含操作类型）：按顺序还原画布状态后渲染。

    type 取值：'draw' | 'erase' | 'undo' | 'clear'。
    """

    type: str = "draw"
    points: list[AIDrawPoint] = []
    color: str = "#000000"
    width: float = 4.0


class RecognizeStrokesRequest(BaseModel):
    """AI 猜词（联机模式 AI 玩家用）：按笔画轨迹渲染图片后识别。

    strokes 来自房间内画者的画布同步事件（含 draw/erase），
    由 ai-service 渲染为 PNG 再调用多模态模型识别；是否猜对由调用方精确匹配判定。
    """

    strokes: list[RecognizeStroke]
    targetWord: str
    difficulty: str  # 'easy' | 'medium' | 'hard'
    provider: str = "qwen"  # 'qwen'（OpenAI 兼容）| 'minimax'（Anthropic 协议）


class RecognizeStrokesResponse(BaseModel):
    """返回原始候选词列表（不做匹配判定，由调用方精确匹配）。"""

    guesses: list[AIGuess]
    processingTime: int


class StoryChapterContent(BaseModel):
    id: str
    chapterNumber: int
    title: str
    narrative: str
    illustrationPrompt: str
    drawingPrompt: str
    keyElements: list[str]


class GenerateStoryRequest(BaseModel):
    theme: str


class GenerateStoryResponse(BaseModel):
    title: str
    chapters: list[StoryChapterContent]


class EvaluateDrawingRequest(BaseModel):
    image: str
    theme: str
    chapterNumber: int
    chapterTitle: str
    drawingPrompt: str
    keyElements: list[str]
    provider: str = "qwen"


class EvaluationResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    stars: int = Field(ge=1, le=3)
    feedback: str
    recognizedElements: list[str]
    nextNarrative: str
    branchType: str
    evaluationMode: str
