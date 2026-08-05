"""AI 绘画服务：调用 minimax-m3 生成「绘画行为」（笔画轨迹）。

不使用文生图，而是让大模型根据目标词规划简笔画的笔画轨迹（坐标点序列），
前端在 Canvas 上按轨迹重现绘制，模拟 AI "亲手画" 的过程。
"""

import asyncio
import hashlib
import json
import logging
import math
import re
from typing import Any

import httpx

from src.config import settings
from src.schemas import AIDrawPoint, AIDrawStroke

logger = logging.getLogger("ai_service.draw")

# 画布逻辑尺寸（与 packages/shared 的 CANVAS_WIDTH/HEIGHT 一致）
CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600

DRAW_PROMPT = f"""你是"你画我猜"游戏的 AI 画家。根据词语规划简笔画笔画轨迹，前端在 {CANVAS_WIDTH}x{CANVAS_HEIGHT} 画布上重现。

要求：
1. 用 {{stroke_count}} 条笔画画出该事物，每条笔画是连续坐标点
2. 坐标范围 x: 0~{CANVAS_WIDTH}，y: 0~{CANVAS_HEIGHT}，主体居中
3. 每条笔画 2~15 个点，只取拐点即可，点尽量稀疏
4. color 用十六进制（如 "#000000"），width 用 2~6 的数字
5. 只返回一个 JSON 数组，不要任何解释、不要推理过程

格式（严格遵守，点用 [x,y] 数组）：
[{{"points":[[400,300],[380,310]],"color":"#000000","width":4}}]"""

# 不同难度的笔画复杂度：简单少笔画、困难多笔画
_DIFFICULTY_STROKES = {
    "easy": "3~5",
    "medium": "5~7",
    "hard": "7~10",
}


class DrawError(Exception):
    """AI 绘画生成过程中的异常。"""


def _strip_code_fence(content: str) -> str:
    """剥离 ```json ... ``` 之类的 markdown 代码块标记。"""
    stripped = content.strip()
    if stripped.startswith("```"):
        nl = stripped.find("\n")
        if nl != -1:
            stripped = stripped[nl + 1 :]
        if stripped.rstrip().endswith("```"):
            stripped = stripped.rstrip()[:-3]
    return stripped.strip()


# 兜底正则：逐个提取完整的 {"points":[...], "color":"...", "width":...} 对象
_STROKE_RE = re.compile(
    r'\{\s*"points"\s*:\s*\[(.*?)\]\s*,\s*"color"\s*:\s*"([^"]*)"\s*,\s*"width"\s*:\s*([0-9]*\.?[0-9]+)\s*\}',
    re.DOTALL,
)
# 同时识别 [x,y] 数组 与 {"x":..,"y":..} 字典 两种点格式（提示词要求用数组，但模型可能混用）
_POINT_RE = re.compile(
    r'\[\s*(-?[0-9]*\.?[0-9]+)\s*,\s*(-?[0-9]*\.?[0-9]+)\s*\]'  # [x,y]
    r'|\{\s*"x"\s*:\s*(-?[0-9]*\.?[0-9]+)\s*,\s*"y"\s*:\s*(-?[0-9]*\.?[0-9]+)\s*\}'  # {"x":..,"y":..}
)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _parse_strokes(content: str) -> list[AIDrawStroke]:
    """从模型返回内容中解析笔画列表，对非标准 / 被截断的输出做多层容错。"""
    if not content:
        return []

    # 1. 剥离 markdown 代码块后尝试整段解析
    cleaned = _strip_code_fence(content)
    data: Any = None
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
            except json.JSONDecodeError:
                data = None

    strokes: list[AIDrawStroke] = []

    def _parse_point(p: Any) -> AIDrawPoint | None:
        """支持 {"x":..,"y":..} 对象 和 [x, y] 数组 两种格式。"""
        if isinstance(p, dict):
            try:
                x = float(p.get("x", 0))
                y = float(p.get("y", 0))
            except (TypeError, ValueError):
                return None
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            try:
                x = float(p[0])
                y = float(p[1])
            except (TypeError, ValueError):
                return None
        else:
            return None
        return AIDrawPoint(x=_clamp(x, 0, CANVAS_WIDTH), y=_clamp(y, 0, CANVAS_HEIGHT))

    def _from_item(item: Any) -> AIDrawStroke | None:
        if not isinstance(item, dict):
            return None
        raw_points = item.get("points", [])
        if not isinstance(raw_points, list) or not raw_points:
            return None
        pts: list[AIDrawPoint] = []
        for p in raw_points:
            pt = _parse_point(p)
            if pt:
                pts.append(pt)
        if not pts:
            return None
        color = str(item.get("color", "#000000"))
        try:
            width = float(item.get("width", 4))
        except (TypeError, ValueError):
            width = 4.0
        return AIDrawStroke(points=pts, color=color, width=_clamp(width, 1, 20))

    if isinstance(data, list):
        for item in data:
            stroke = _from_item(item)
            if stroke:
                strokes.append(stroke)
        if strokes:
            return strokes

    # 2. 兜底：逐个正则提取完整 stroke 对象（应对截断 / 格式不标准）
    for m in _STROKE_RE.finditer(content):
        pts_str = m.group(1)
        pts: list[AIDrawPoint] = []
        for pm in _POINT_RE.finditer(pts_str):
            if pm.group(1) is not None:
                # [x, y] 数组格式
                x = float(pm.group(1))
                y = float(pm.group(2))
            else:
                # {"x":.., "y":..} 字典格式
                x = float(pm.group(3))
                y = float(pm.group(4))
            pts.append(AIDrawPoint(x=_clamp(x, 0, CANVAS_WIDTH), y=_clamp(y, 0, CANVAS_HEIGHT)))
        if not pts:
            continue
        color = m.group(2) or "#000000"
        try:
            width = float(m.group(3))
        except ValueError:
            width = 4.0
        strokes.append(AIDrawStroke(points=pts, color=color, width=_clamp(width, 1, 20)))

    return strokes


async def _call_model(target_word: str, difficulty: str, reasoning_effort: str | None) -> list[AIDrawStroke]:
    """单次调用 minimax 生成笔画轨迹，返回解析到的笔画（失败返回空列表，由调用方决定兜底）。

    `difficulty` 控制笔画复杂度（easy 3-5 笔 / medium 5-7 笔 / hard 7-10 笔），
    影响生成耗时——简单难度笔画少、出图快，困难难度笔画多、出图慢。
    `reasoning_effort="low"` 用于抑制推理模型先吐 `reasoning_content` 占满 token 的行为；
    若端点不支持该参数（返回 400），此处当作普通错误吞掉，由调用方去掉参数重试。
    """
    url = f"{settings.minimax_base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.minimax_api_key}",
        "Content-Type": "application/json",
    }
    stroke_count = _DIFFICULTY_STROKES.get(difficulty, "3~8")
    prompt = DRAW_PROMPT.replace("{stroke_count}", stroke_count)
    payload: dict[str, Any] = {
        "model": settings.minimax_model,
        "messages": [
            {
                "role": "user",
                "content": f"{prompt}\n\n请画：「{target_word}」",
            }
        ],
        "max_tokens": 8192,
        "temperature": 0.5,
    }
    if reasoning_effort:
        payload["reasoning_effort"] = reasoning_effort

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=5.0)) as client:
            # 用 asyncio.wait_for 强制总超时（httpx 的 read timeout 只限制单次读取间隔，
            # 千问流式响应持续有 chunk 时不触发，需 wait_for 限制总时长，防真卡死）
            resp = await asyncio.wait_for(client.post(url, headers=headers, json=payload), timeout=60.0)
    except asyncio.TimeoutError:
        logger.warning("AI 绘画调用总耗时超 60s，走兜底")
        return []
    except httpx.HTTPError as exc:
        logger.error("调用 AI 绘画 API 网络错误: %s", exc)
        return []

    if resp.status_code != 200:
        body = resp.text[:300] if resp.text else ""
        logger.error("AI 绘画 API 返回非 200: %s, 响应: %s", resp.status_code, body)
        return []

    try:
        data = resp.json()
    except json.JSONDecodeError as exc:
        logger.error("解析 AI 绘画响应失败: %s", exc)
        return []

    choices = data.get("choices") or []
    if not choices:
        logger.error("AI 绘画响应中没有 choices")
        return []
    content = choices[0].get("message", {}).get("content", "")
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))

    finish_reason = choices[0].get("finish_reason")
    if finish_reason == "length":
        logger.warning("AI 绘画输出因 max_tokens 截断(finish_reason=length)")

    strokes = _parse_strokes(content)
    if not strokes:
        logger.error("无法从模型输出中解析笔画，原始内容: %r", content[:500])
    return strokes


def _fallback_strokes(target_word: str) -> list[AIDrawStroke]:
    """兜底简笔画：模型输出失败时按目标词哈希生成基本几何线条，
    保证前端总能拿到笔画、链路不断。画技抽象，仅供"有东西可猜"。"""
    seed = int(hashlib.md5(target_word.encode("utf-8")).hexdigest(), 16)
    cx, cy = CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2
    strokes: list[AIDrawStroke] = []

    # 按哈希选择一个主形状（圆 / 矩形 / 三角）
    shape = seed % 3
    if shape == 0:
        # 圆
        r = 120 + (seed % 60)
        pts = [
            AIDrawPoint(
                x=_clamp(cx + r * math.cos(math.radians(i)), 0, CANVAS_WIDTH),
                y=_clamp(cy + r * math.sin(math.radians(i)), 0, CANVAS_HEIGHT),
            )
            for i in range(0, 361, 30)
        ]
        strokes.append(AIDrawStroke(points=pts, color="#000000", width=4))
    elif shape == 1:
        # 矩形
        w = 200 + (seed % 80)
        h = 140 + (seed % 60)
        strokes.append(
            AIDrawStroke(
                points=[
                    AIDrawPoint(x=cx - w / 2, y=cy - h / 2),
                    AIDrawPoint(x=cx + w / 2, y=cy - h / 2),
                    AIDrawPoint(x=cx + w / 2, y=cy + h / 2),
                    AIDrawPoint(x=cx - w / 2, y=cy + h / 2),
                    AIDrawPoint(x=cx - w / 2, y=cy - h / 2),
                ],
                color="#000000",
                width=4,
            )
        )
    else:
        # 三角
        s = 160 + (seed % 60)
        strokes.append(
            AIDrawStroke(
                points=[
                    AIDrawPoint(x=cx, y=cy - s),
                    AIDrawPoint(x=cx - s, y=cy + s),
                    AIDrawPoint(x=cx + s, y=cy + s),
                    AIDrawPoint(x=cx, y=cy - s),
                ],
                color="#000000",
                width=4,
            )
        )

    # 追加一条偏移横线作为第二笔，凑够 2 笔（前端 <3 笔会显示"画技不佳"提示）
    off = (seed % 80) - 40
    strokes.append(
        AIDrawStroke(
            points=[
                AIDrawPoint(x=cx - 100 + off, y=cy + 130),
                AIDrawPoint(x=cx + 100 + off, y=cy + 130),
            ],
            color="#000000",
            width=4,
        )
    )
    return strokes


async def generate_drawing(target_word: str, difficulty: str = "easy") -> list[AIDrawStroke]:
    """调用 minimax 生成目标词的笔画轨迹；模型输出失败则用兜底简笔画，保证链路不断。

    `difficulty` 控制笔画复杂度：easy 3-5 笔 / medium 5-7 笔 / hard 7-10 笔。
    """
    if not settings.minimax_api_key:
        raise DrawError("MINIMAX_API_KEY 未配置")

    # 只调一次千问；reasoning_effort=low 抑制推理输出，端点不支持时 _call_model 会当普通错误吞掉。
    strokes = await _call_model(target_word, difficulty=difficulty, reasoning_effort="low")
    if strokes:
        return strokes

    # 失败即兜底简笔画，保证前端有可猜内容、链路不卡
    logger.warning("AI 绘画解析失败，使用兜底简笔画: %s", target_word)
    return _fallback_strokes(target_word)
