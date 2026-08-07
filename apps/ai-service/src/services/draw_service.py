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

DRAW_PROMPT = f"""你是"你画我猜"游戏的 AI 画家，擅长画可辨识的简笔画。前端在 {CANVAS_WIDTH}x{CANVAS_HEIGHT} 画布上重现你的笔画。

画法要求：
1. 先提炼该事物的 3 个最鲜明视觉特征，据此构图（如苹果=红色圆身+顶部果柄+一片叶子；鸟=尖嘴向上+侧身收拢翅膀+站在树枝上）
2. 先在脑中分解视觉部件，每个部件用一条或多条笔画
3. 用 {{stroke_count}} 条笔画，每条笔画 5~30 个点（点越密曲线越圆滑，画圆弧时多点才能画圆）
4. 主体居中、大小适中（占画布 1/3~1/2），各部件比例正确、位置关系对
5. 绘画风格统一：简洁线条 + 鲜明色彩，避免过多细节，让核心元素一目了然
6. 若是名词画具有辨识度的物体；若是动作/动词，画出动作场景（如"跳舞"画一个舞姿的人）
7. 画出来的图必须能让人一眼认出是什么——抓住该事物的标志性特征，特征明显且无歧义
8. color 用十六进制（如 "#000000" 黑、"#E74C3C" 红、"#2D9A3E" 绿），width 3~5

只返回 JSON 数组，点用 [x,y] 数组，不要解释：
[{{"points":[[400,300],[380,310]],"color":"#000000","width":4}}]"""

# 不同难度的笔画复杂度：简单少笔画、困难多笔画
_DIFFICULTY_STROKES = {
    "easy": "5~10",
    "medium": "8~15",
    "hard": "12~25",
}

# 第一步：生成「绘画提示词」的模板（用户指定）
DRAW_PROMPT_TEMPLATE = """在接下来的对话中，每当您需要画一幅简笔画来帮助我猜词时，请按以下步骤自动操作：
1. 为要画的词语提炼出 3 个最鲜明的视觉特征。
2. 生成一个包含这些特征的绘画提示词，格式为：[提示词内容]。
3. 提示词中需包含：主体描述、动作姿态、线条风格（清晰简洁）、背景（纯白）。
4. 请确保提示词生成的图像对猜词有帮助，特征明显且无歧义。
示例输出：绘画提示词：一只站在树枝上的鸟，侧身，尖嘴向上，翅膀收拢，黑色轮廓线，白色背景。
现在，请按照此规则执行。"""


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


async def _send_text_request(
    prompt: str, provider: str, max_tokens: int, reasoning_effort: str | None = None, timeout: float = 60.0
) -> str:
    """向指定 provider 发送单次文本请求，返回模型输出的文本（失败返回空字符串）。

    provider="qwen"：OpenAI 兼容端点；provider="minimax"：Anthropic 协议端点。
    `reasoning_effort="low"` 仅 qwen 用，抑制推理模型先吐 reasoning_content 占满 token。
    """
    if provider == "minimax":
        if not settings.minimax_anthropic_api_key:
            raise DrawError("MINIMAX_ANTHROPIC_API_KEY 未配置")
        url = f"{settings.minimax_anthropic_base_url}/v1/messages"
        headers = {
            "x-api-key": settings.minimax_anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": settings.minimax_anthropic_model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        }
    else:
        if not settings.minimax_api_key:
            raise DrawError("MINIMAX_API_KEY 未配置")
        url = f"{settings.minimax_base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.minimax_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.minimax_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.5,
        }
        if reasoning_effort:
            payload["reasoning_effort"] = reasoning_effort

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=5.0)) as client:
            # 用 asyncio.wait_for 强制总超时（httpx 的 read timeout 只限制单次读取间隔，
            # 流式响应持续有 chunk 时不触发，需 wait_for 限制总时长，防真卡死）
            resp = await asyncio.wait_for(client.post(url, headers=headers, json=payload), timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning("AI 绘画调用总耗时超 %ss", timeout)
        return ""
    except httpx.HTTPError as exc:
        logger.error("调用 AI 绘画 API 网络错误: %s", exc)
        return ""

    if resp.status_code != 200:
        body = resp.text[:300] if resp.text else ""
        logger.error("AI 绘画 API 返回非 200: %s, 响应: %s", resp.status_code, body)
        return ""

    try:
        data = resp.json()
    except json.JSONDecodeError as exc:
        logger.error("解析 AI 绘画响应失败: %s", exc)
        return ""

    content, _ = _extract_text(data, provider)
    return content


async def _generate_draw_prompt(target_word: str, provider: str) -> str:
    """第一步：按模板让模型为词语生成「绘画提示词」（描述主体/动作/线条/背景的文字）。"""
    prompt = f"{DRAW_PROMPT_TEMPLATE}\n\n请为「{target_word}」生成绘画提示词。"
    text = await _send_text_request(prompt, provider, max_tokens=512, timeout=30.0)
    if not text:
        logger.warning("生成绘画提示词失败，走兜底直接画")
    return text


async def _call_model(
    target_word: str, difficulty: str, provider: str, reasoning_effort: str | None
) -> list[AIDrawStroke]:
    """两步生成笔画轨迹，返回解析到的笔画（失败返回空列表，由调用方决定兜底）。

    第一步：生成绘画提示词（描述主体/动作/线条）；第二步：据提示词输出笔画 JSON。
    `difficulty` 控制笔画复杂度（easy 5-10 / medium 8-15 / hard 12-25 笔）。
    `provider`："qwen" 走 OpenAI 兼容端点，"minimax" 走 Anthropic 协议端点。
    """
    # 第一步：生成绘画提示词（30s 超时，保证两步合计 < server 105s 超时）
    draw_prompt_text = await _generate_draw_prompt(target_word, provider)

    # 第二步：据提示词输出笔画
    stroke_count = _DIFFICULTY_STROKES.get(difficulty, "5~10")
    prompt = DRAW_PROMPT.replace("{stroke_count}", stroke_count)
    if draw_prompt_text:
        full_prompt = f"{prompt}\n\n绘画提示词：{draw_prompt_text}\n\n请严格按此提示词画「{target_word}」的简笔画。"
    else:
        # 提示词生成失败，退化为直接画
        full_prompt = f"{prompt}\n\n请画：「{target_word}」"

    content = await _send_text_request(full_prompt, provider, max_tokens=8192, reasoning_effort=reasoning_effort)
    if not content:
        return []

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


async def generate_drawing(
    target_word: str, difficulty: str = "easy", provider: str = "qwen"
) -> list[AIDrawStroke]:
    """调用 AI 生成目标词的笔画轨迹；模型输出失败则用兜底简笔画，保证链路不断。

    `difficulty` 控制笔画复杂度：easy 3-5 笔 / medium 5-7 笔 / hard 7-10 笔。
    `provider`："qwen" 走 OpenAI 兼容端点，"minimax" 走 Anthropic 协议端点。
    """
    if provider == "minimax":
        if not settings.minimax_anthropic_api_key:
            raise DrawError("MINIMAX_ANTHROPIC_API_KEY 未配置")
    else:
        if not settings.minimax_api_key:
            raise DrawError("MINIMAX_API_KEY 未配置")

    # 只调一次；qwen 用 reasoning_effort=low 抑制推理输出，minimax 无该参数。
    strokes = await _call_model(
        target_word, difficulty=difficulty, provider=provider, reasoning_effort="low"
    )
    if strokes:
        return strokes

    # 失败即兜底简笔画，保证前端有可猜内容、链路不卡
    logger.warning("AI 绘画解析失败，使用兜底简笔画: %s", target_word)
    return _fallback_strokes(target_word)


def _extract_text(data: dict[str, Any], provider: str) -> tuple[str, bool]:
    """从响应里提取模型输出的文本，返回 (text, truncated)。

    OpenAI：choices[0].message.content（字符串或分段数组），finish_reason=="length" 表截断
    Anthropic：content 数组里 type=="text" 的 text 拼接，stop_reason=="max_tokens" 表截断
    """
    if provider == "minimax":
        blocks = data.get("content") or []
        text = "".join(
            b.get("text", "") for b in blocks if isinstance(b, dict) and b.get("type") == "text"
        )
        return text, data.get("stop_reason") == "max_tokens"

    choices = data.get("choices") or []
    if not choices:
        return "", False
    choice = choices[0]
    content = choice.get("message", {}).get("content", "")
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return content or "", choice.get("finish_reason") == "length"
