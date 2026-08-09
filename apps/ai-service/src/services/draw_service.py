"""AI 绘画服务：调用 minimax-m3 生成「绘画行为」（笔画轨迹）。

不使用文生图，而是让大模型根据目标词规划简笔画的笔画轨迹（坐标点序列），
前端在 Canvas 上按轨迹重现绘制，模拟 AI "亲手画" 的过程。
"""

import asyncio
import base64
import hashlib
import io
import json
import logging
import math
import re
from typing import Any

import httpx
from PIL import Image, ImageDraw

from src.config import settings
from src.schemas import AIDrawPoint, AIDrawStroke, RecognizeStroke

logger = logging.getLogger("ai_service.draw")

# 画布逻辑尺寸（与 packages/shared 的 CANVAS_WIDTH/HEIGHT 一致）
CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600

DRAW_PROMPT = f"""你是“你画我猜”游戏的简笔画轨迹设计师。请把给定的结构化构图方案转换成可直接绘制的笔画 JSON。

画布与构图规则：
1. 画布为 {CANVAS_WIDTH}x{CANVAS_HEIGHT}，所有坐标必须在范围内；主体只能放在安全区域 x=60~740、y=50~550。
2. 使用构图方案指定的典型视角。主体居中且醒目，其较长方向应占对应画布尺寸的 60%~75%，不能缩在中央，也不能碰到边缘。
3. 严格保持部件的大小、方向、前后、上下、连接和对称关系。例如眼睛位于头部内，轮子连接车身下方，叶子连接果梗，左右成对部件大小和高度一致。
4. 按“主体外轮廓 → 最大识别部件 → 次要识别部件 → 必要的内部线条/颜色”的顺序绘制。每一笔都必须对应构图方案里的主体或命名部件。
5. 先用 #000000、宽度 4~5 的连续线条建立清楚轮廓，再使用最多 3 种符合真实语义的鲜明颜色强调关键部件；不要用颜色替代缺失的轮廓。
6. 闭合轮廓的最后一个点必须与第一个点相同。圆、椭圆和弧线使用 10~24 个顺序平滑的点；直线使用 2~5 个点。禁止相互乱穿、无意义折返和散乱短线。

准确性规则：
7. 必须优先表现 silhouette 和 priority 为 1 的部件，再表现其他部件；宁可减少装饰，也不能遗漏最能区分目标的特征。
8. 使用 {{stroke_count}} 条笔画。若特征较多，合并同一部件的连续线条，但不能把互不相连的部件硬连成一笔。
9. 只画一个主要对象。除非构图方案明确说明动作必需，否则不要添加背景、地面线、边框、阴影、纹理、装饰或无关物体。
10. 绝对不要写目标词、文字、字母、数字、标签、箭头、表情符号或任何可直接泄露答案的符号。
11. 输出前自行检查：主体尺寸合适；每个关键部件存在且位置正确；闭合形状已闭合；笔画数符合要求；所有坐标均在画布内。

输出协议：
- 只返回一个合法 JSON 数组，不要 Markdown、解释、注释或思考过程。
- 数组元素只能包含 points、color、width 三个字段。
- points 必须是 [x,y] 数字数组，color 必须是 #RRGGBB，width 必须是 3~5。
- 示例格式：[{{"points":[[400,120],[450,140]],"color":"#000000","width":4}}]"""

# 不同难度的笔画复杂度：简单少笔画、困难多笔画
_DIFFICULTY_STROKES = {
    "easy": "5~10",
    "medium": "8~15",
    "hard": "12~25",
}

# 第一步：生成「绘画提示词」的模板（用户指定）
DRAW_PROMPT_TEMPLATE = """你是“你画我猜”游戏的视觉构图规划师。你的任务不是写文艺描述，而是为目标词设计一幅最容易被普通玩家认出的简笔画。

规划规则：
1. 先确定目标最常见、最无歧义的含义，选择大众最熟悉的典型外形和典型视角；不要采用罕见含义、拟人化造型或艺术化变形。
2. 只安排一个大而居中的主体。主体应占画布主要区域，轮廓必须在没有颜色和细节时仍可辨认。
3. 找出 3~5 个真正具有区分度的视觉部件，并明确每个部件的简单几何形状、相对大小、绝对方位以及与其他部件的连接/包含/对称关系。
4. priority=1 表示缺少后会认错的核心特征；priority=2 表示辅助特征。不要把普通装饰当作核心特征。
5. 名词画对象本身；动物或交通工具优先使用能展示最多特征的侧面或四分之三视角；人物动作要用清楚的四肢姿态表现动作。
6. 配色遵循真实世界的典型颜色，最多 3 种主体色，黑色轮廓不计入。颜色只用于增强识别，不能依赖复杂填充。
7. avoid 必须列出容易与目标混淆的造型，以及文字、标签、箭头、装饰背景和无关物体。除动作语义必需外，不规划第二个对象。

只返回一个合法 JSON 对象，不要 Markdown、解释或思考过程，字段必须完整：
{
  "subject": "目标对象的明确名称",
  "view": "正面/侧面/俯视/四分之三视角及朝向",
  "silhouette": "一句话描述主体整体轮廓、长宽比例与显著凸出部分",
  "composition": "主体中心位置、占画布比例和姿态",
  "parts": [
    {
      "name": "部件名",
      "shape": "可用线条表达的简单形状和相对大小",
      "position": "相对主体的准确方位",
      "relation": "与主体或其他部件的连接、包含、遮挡或对称关系",
      "color": "典型十六进制颜色",
      "priority": 1
    }
  ],
  "palette": ["#RRGGBB"],
  "avoid": ["禁止出现的混淆造型或干扰元素"]
}"""


class DrawError(Exception):
    """AI 绘画生成过程中的异常。"""


def strokes_to_png_base64(strokes: list[RecognizeStroke]) -> str:
    """把画布同步笔画渲染成 800x600 白底 PNG，返回原始 base64（无 data URI 前缀）。

    用于联机模式 AI 猜词：画者在画布上的笔画（draw/erase）经过顺序还原
    （undo 移除上一笔、clear 清空）后渲染为图片，再交给多模态模型识别。
    """
    # 顺序还原画布状态：undo 弹出上一笔、clear 清空（与前端画布行为一致）
    active: list[RecognizeStroke] = []
    for stroke in strokes:
        if stroke.type == "clear":
            active.clear()
        elif stroke.type == "undo":
            if active:
                active.pop()
        else:
            active.append(stroke)

    img = Image.new("RGB", (CANVAS_WIDTH, CANVAS_HEIGHT), "white")
    draw = ImageDraw.Draw(img)
    for stroke in active:
        pts = [(p.x, p.y) for p in stroke.points]
        if len(pts) < 2:
            continue
        # erase 笔画以白色绘制，模拟橡皮擦除效果
        color = "#ffffff" if stroke.type == "erase" else (stroke.color or "#000000")
        width = max(1, min(int(stroke.width or 4), 20))
        draw.line(pts, fill=color, width=width, joint="curve")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


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
    """第一步：让模型为目标词生成结构化视觉构图方案。"""
    prompt = f"{DRAW_PROMPT_TEMPLATE}\n\n目标词：{target_word}\n请严格按上述 JSON 结构生成构图方案。"
    text = await _send_text_request(prompt, provider, max_tokens=1024, timeout=30.0)
    if not text:
        logger.warning("生成绘画提示词失败，走兜底直接画")
    return text


async def _call_model(
    target_word: str, difficulty: str, provider: str, reasoning_effort: str | None
) -> list[AIDrawStroke]:
    """两步生成笔画轨迹，返回解析到的笔画（失败返回空列表，由调用方决定兜底）。

    第一步：生成结构化视觉构图方案；第二步：据构图方案输出笔画 JSON。
    `difficulty` 控制笔画复杂度（easy 5-10 / medium 8-15 / hard 12-25 笔）。
    `provider`："qwen" 走 OpenAI 兼容端点，"minimax" 走 Anthropic 协议端点。
    """
    # 第一步：生成结构化构图方案（30s 超时，保证两步合计 < server 105s 超时）
    draw_prompt_text = await _generate_draw_prompt(target_word, provider)

    # 第二步：据提示词输出笔画
    stroke_count = _DIFFICULTY_STROKES.get(difficulty, "5~10")
    prompt = DRAW_PROMPT.replace("{stroke_count}", stroke_count)
    if draw_prompt_text:
        full_prompt = (
            f"{prompt}\n\n目标词：{target_word}\n"
            f"结构化构图方案：\n{draw_prompt_text}\n\n"
            "请严格依照该方案生成简笔画轨迹，并在输出前完成规则自检。"
        )
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
