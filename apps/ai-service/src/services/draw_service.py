"""AI 绘画服务：调用 minimax-m3 生成「绘画行为」（笔画轨迹）。

不使用文生图，而是让大模型根据目标词规划简笔画的笔画轨迹（坐标点序列），
前端在 Canvas 上按轨迹重现绘制，模拟 AI "亲手画" 的过程。
"""

import json
import logging
import re
from typing import Any

import httpx

from src.config import settings
from src.schemas import AIDrawPoint, AIDrawStroke

logger = logging.getLogger("ai_service.draw")

# 画布逻辑尺寸（与 packages/shared 的 CANVAS_WIDTH/HEIGHT 一致）
CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600

DRAW_PROMPT = f"""你是一个"你画我猜"游戏中的 AI 画家。请根据给定的词语，规划简笔画的笔画轨迹，让前端能在 {CANVAS_WIDTH}x{CANVAS_HEIGHT} 的画布上重现绘制。

要求：
1. 用若干条笔画（stroke）画出该事物，每条笔画是一组连续的坐标点
2. 坐标范围：x 在 0~{CANVAS_WIDTH}，y 在 0~{CANVAS_HEIGHT}，画面主体居中
3. 笔画要简洁，总笔画数 3~15 条，每条笔画 2~40 个点
4. color 用十六进制颜色（如 "#000000" 黑、"#FF6B00" 橙等），width 用 2~8 的数字
5. 只返回一个 JSON 数组，不要任何其他文字或解释

返回格式（严格遵守）：
[{{"points":[[400,300],[380,310]], "color":"#000000", "width":4}}]"""


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
_POINT_RE = re.compile(r'\{\s*"x"\s*:\s*(-?[0-9]*\.?[0-9]+)\s*,\s*"y"\s*:\s*(-?[0-9]*\.?[0-9]+)\s*\}')


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
            x = _clamp(float(pm.group(1)), 0, CANVAS_WIDTH)
            y = _clamp(float(pm.group(2)), 0, CANVAS_HEIGHT)
            pts.append(AIDrawPoint(x=x, y=y))
        if not pts:
            continue
        color = m.group(2) or "#000000"
        try:
            width = float(m.group(3))
        except ValueError:
            width = 4.0
        strokes.append(AIDrawStroke(points=pts, color=color, width=_clamp(width, 1, 20)))

    return strokes


async def generate_drawing(target_word: str) -> list[AIDrawStroke]:
    """调用 minimax 生成目标词的笔画轨迹。"""
    if not settings.minimax_api_key:
        raise DrawError("MINIMAX_API_KEY 未配置")

    url = f"{settings.minimax_base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.minimax_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.minimax_model,
        "messages": [
            {
                "role": "user",
                "content": f"{DRAW_PROMPT}\n\n请画：「{target_word}」",
            }
        ],
        "max_tokens": 4096,
        "temperature": 0.8,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        logger.error("调用 AI 绘画 API 网络错误: %s", exc)
        raise DrawError(f"调用 AI 绘画 API 网络错误: {exc}") from exc

    if resp.status_code != 200:
        body = resp.text[:300] if resp.text else ""
        logger.error("AI 绘画 API 返回非 200: %s, 响应: %s", resp.status_code, body)
        raise DrawError(f"AI 绘画 API 返回非 200 状态码: {resp.status_code}, 响应: {body}")

    try:
        data = resp.json()
    except json.JSONDecodeError as exc:
        raise DrawError(f"解析 AI 绘画响应失败: {exc}") from exc

    choices = data.get("choices") or []
    if not choices:
        raise DrawError("AI 绘画响应中没有 choices")
    content = choices[0].get("message", {}).get("content", "")
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))

    finish_reason = choices[0].get("finish_reason")
    if finish_reason == "length":
        logger.warning("AI 绘画输出因 max_tokens 截断(finish_reason=length)")

    strokes = _parse_strokes(content)
    if not strokes:
        logger.error("无法从模型输出中解析笔画，原始内容: %r", content[:500])
        raise DrawError("无法从模型输出中解析笔画")

    return strokes
