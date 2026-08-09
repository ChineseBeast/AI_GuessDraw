"""AI 路由：识别 /api/v1/ai/recognize、绘画 /api/v1/ai/generate-drawing。"""

import time

from fastapi import APIRouter, HTTPException

from src.schemas import (
    AIGuess,
    DrawRequest,
    DrawResponse,
    EvaluateDrawingRequest,
    EvaluationResponse,
    GenerateStoryRequest,
    GenerateStoryResponse,
    RecognizeRequest,
    RecognizeResponse,
    RecognizeStrokesRequest,
    RecognizeStrokesResponse,
)
from src.services.draw_service import DrawError, generate_drawing, strokes_to_png_base64
from src.services.minimax_service import MiniMaxError, recognize_drawing
from src.services.story_service import evaluate_drawing, generate_story


router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


def _is_match(guess_word: str, target: str) -> bool:
    """候选词与目标词是否匹配（精确相等或互相包含，用于判定 AI 是否猜对）。"""
    g = guess_word.strip()
    t = target.strip()
    if not g or not t:
        return False
    return g == t or g in t or t in g


@router.post("/recognize", response_model=RecognizeResponse)
async def recognize(req: RecognizeRequest) -> RecognizeResponse:
    start = time.time()

    # 校验图片
    if not req.image or len(req.image) < 100:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_IMAGE", "message": "图片数据无效"},
        )

    if req.difficulty not in ("easy", "medium", "hard"):
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_REQUEST", "message": "无效的 difficulty 参数"},
        )

    # 调用 MiniMax 识别
    try:
        guesses = await recognize_drawing(req.image, req.provider)
    except MiniMaxError as exc:
        raise HTTPException(
            status_code=503,
            detail={"error": "AI_SERVICE_UNAVAILABLE", "message": f"AI 服务暂时不可用: {exc}"},
        ) from exc

    # 与目标词匹配，判定是否猜对
    matched: AIGuess | None = None
    for g in guesses:
        if _is_match(g.word, req.targetWord):
            matched = g
            break

    processing_time = int((time.time() - start) * 1000)

    return RecognizeResponse(
        guesses=guesses,
        isCorrect=matched is not None,
        matchedGuess=matched,
        processingTime=processing_time,
    )


@router.post("/generate-drawing", response_model=DrawResponse)
async def generate_drawing_route(req: DrawRequest) -> DrawResponse:
    """AI 绘画：根据目标词生成笔画轨迹（绘画行为），前端在 Canvas 上重现绘制。"""
    start = time.time()

    if not req.targetWord or not req.targetWord.strip():
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_REQUEST", "message": "targetWord 不能为空"},
        )

    if req.difficulty not in ("easy", "medium", "hard"):
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_REQUEST", "message": "无效的 difficulty 参数"},
        )

    try:
        strokes = await generate_drawing(req.targetWord, req.difficulty, req.provider)
    except DrawError as exc:
        raise HTTPException(
            status_code=503,
            detail={"error": "AI_SERVICE_UNAVAILABLE", "message": f"AI 绘画服务暂时不可用: {exc}"},
        ) from exc

    processing_time = int((time.time() - start) * 1000)

    return DrawResponse(strokes=strokes, processingTime=processing_time)


@router.post("/recognize-strokes", response_model=RecognizeStrokesResponse)
async def recognize_strokes_route(req: RecognizeStrokesRequest) -> RecognizeStrokesResponse:
    """AI 猜词（联机模式）：根据画布笔画轨迹渲染图片后识别，返回原始候选词。

    不做模糊匹配判定（由调用方精确匹配是否猜对），便于 AI 玩家多次猜测。
    """
    start = time.time()

    if not req.strokes:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_REQUEST", "message": "strokes 不能为空"},
        )

    if req.difficulty not in ("easy", "medium", "hard"):
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_REQUEST", "message": "无效的 difficulty 参数"},
        )

    try:
        image_base64 = strokes_to_png_base64(req.strokes)
        guesses = await recognize_drawing(image_base64, req.provider)
    except MiniMaxError as exc:
        raise HTTPException(
            status_code=503,
            detail={"error": "AI_SERVICE_UNAVAILABLE", "message": f"AI 服务暂时不可用: {exc}"},
        ) from exc

    processing_time = int((time.time() - start) * 1000)

    return RecognizeStrokesResponse(guesses=guesses, processingTime=processing_time)


@router.post("/generate-story", response_model=GenerateStoryResponse)
async def generate_story_route(req: GenerateStoryRequest) -> GenerateStoryResponse:
    try:
        return generate_story(req.theme)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_THEME", "message": "不支持的故事主题"},
        ) from exc


@router.post("/evaluate-drawing", response_model=EvaluationResponse)
async def evaluate_drawing_route(req: EvaluateDrawingRequest) -> EvaluationResponse:
    try:
        return await evaluate_drawing(req)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_IMAGE", "message": "图片数据无效"},
        ) from exc
