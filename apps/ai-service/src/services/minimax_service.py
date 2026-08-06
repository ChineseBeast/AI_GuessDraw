"""MiniMax 多模态识别服务：调用 minimax-m3 的 Chat Completion API 识别简笔画。"""

import asyncio
import base64
import binascii
import io
import json
import logging
import re
from typing import Any

import httpx
from PIL import Image

from src.config import settings
from src.schemas import AIGuess

logger = logging.getLogger("ai_service.minimax")


RECOGNIZE_PROMPT = """你是一个"你画我猜"游戏的 AI 玩家。请观察这张简笔画图片，猜测画的是什么。

要求：
1. 给出 3 个最可能的猜测，按可能性从高到低排序
2. 每个猜测附带置信度（0 到 1 之间的小数，保留两位小数）
3. 只返回一个 JSON 数组，不要包含任何其他文字或解释

返回格式（严格遵守）：
[{"word": "猜测词1", "confidence": 0.85}, {"word": "猜测词2", "confidence": 0.60}, {"word": "猜测词3", "confidence": 0.30}]"""


class MiniMaxError(Exception):
    """MiniMax 调用过程中的异常（网络错误、配置缺失、响应解析失败等）。"""


def _to_jpeg_normalized(image_input: str) -> tuple[str, str]:
    """将任意输入图片统一转为 JPEG，返回 (media_type, raw_base64)。

    OpenAI 路径与 Anthropic 路径共用此归一化：OpenAI 包成 data URI，
    Anthropic 直接用 raw base64 + media_type 嵌入 source。

    支持输入：
    - `data:image/...;base64,xxxx` data URI
    - 纯 base64 字符串（默认按 PNG/JPEG 尝试解码）
    - `http(s)://...` 公网 URL（media_type 留空，调用方需自备 URL 透传分支）
    """
    # 公网 URL：调用方需单独处理（OpenAI 直接透传 URL，Anthropic 需 fetch 转 base64）
    if image_input.startswith(("http://", "https://")):
        return ("", image_input)

    # 剥离 data URI 前缀，拿到纯 base64
    raw = image_input
    if raw.startswith("data:"):
        comma_idx = raw.find(",")
        if comma_idx == -1:
            raise MiniMaxError("图片 data URI 格式无效：缺少逗号分隔符")
        raw = raw[comma_idx + 1 :]

    try:
        img_bytes = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise MiniMaxError(f"图片 base64 解码失败: {exc}") from exc

    try:
        img = Image.open(io.BytesIO(img_bytes))
        # JPEG 不支持 alpha 通道，转 RGB（白底合成，避免透明区域变黑）
        if img.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")
    except Exception as exc:  # noqa: BLE001 - PIL 抛多种异常，统一包装
        raise MiniMaxError(f"图片解码失败: {exc}") from exc

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    jpeg_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return ("image/jpeg", jpeg_b64)


def _to_jpeg_data_uri(image_input: str) -> str:
    """OpenAI 路径用：归一化为 JPEG data URI。"""
    media_type, raw = _to_jpeg_normalized(image_input)
    if not media_type:  # 公网 URL
        return raw
    return f"data:{media_type};base64,{raw}"


def _build_messages(image_input: str) -> list[dict[str, Any]]:
    """构造 OpenAI 兼容的多模态消息（图片统一转 JPEG data URI）。"""
    image_url = _to_jpeg_data_uri(image_input)
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": RECOGNIZE_PROMPT},
                {"type": "image_url", "image_url": {"url": image_url}},
            ],
        }
    ]


# 兜底正则：逐个提取完整的 {"word": "...", "confidence": ...} 对象，
# 用于应对模型输出被 max_tokens 截断导致 JSON 数组不完整（缺少结尾 ]）的场景。
_OBJ_RE = re.compile(
    r'\{\s*"word"\s*:\s*"([^"]*)"\s*,\s*"confidence"\s*:\s*([0-9]*\.?[0-9]+)\s*\}',
    re.DOTALL,
)


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


def _make_guess(item: Any) -> AIGuess | None:
    """从单个 dict 构造 AIGuess，字段缺失/非法时返回 None。"""
    if not isinstance(item, dict):
        return None
    word = str(item.get("word", "")).strip()
    if not word:
        return None
    try:
        confidence = float(item.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))
    return AIGuess(word=word, confidence=round(confidence, 2))


def _parse_guesses(content: str) -> list[AIGuess]:
    """从模型返回内容中解析候选词列表，对非标准 / 被截断的输出做多层容错提取。"""
    if not content:
        return []

    # 1. 剥离 markdown 代码块后尝试整段解析
    cleaned = _strip_code_fence(content)
    data: Any = None
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # 2. 提取第一个完整 JSON 数组片段
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
            except json.JSONDecodeError:
                data = None

    guesses: list[AIGuess] = []
    if isinstance(data, list):
        for item in data:
            guess = _make_guess(item)
            if guess:
                guesses.append(guess)
        if guesses:
            return guesses

    # 3. 兜底：逐个正则提取完整的 word/confidence 对象，
    #    应对 max_tokens 截断导致数组缺少结尾 ] 的情况（至少能拿到已完成的候选词）。
    for m in _OBJ_RE.finditer(content):
        word = m.group(1).strip()
        if not word:
            continue
        try:
            confidence = float(m.group(2))
        except ValueError:
            confidence = 0.0
        confidence = max(0.0, min(1.0, confidence))
        guesses.append(AIGuess(word=word, confidence=round(confidence, 2)))

    return guesses


async def recognize_drawing(image_base64: str, provider: str = "qwen") -> list[AIGuess]:
    """调用多模态 API 识别图片，返回候选词列表（按置信度排序）。

    provider="qwen"：OpenAI 兼容端点（chat/completions）
    provider="minimax"：Anthropic 协议端点（v1/messages）
    """
    # 构造请求（按 provider 分支）与解析响应，文本内容统一交给 _parse_guesses
    if provider == "minimax":
        if not settings.minimax_anthropic_api_key:
            raise MiniMaxError("MINIMAX_ANTHROPIC_API_KEY 未配置")
        url, headers, payload = _build_anthropic_recognize_request(image_base64)
    else:
        if not settings.minimax_api_key:
            raise MiniMaxError("MINIMAX_API_KEY 未配置")
        url, headers, payload = _build_openai_recognize_request(image_base64)

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=5.0)) as client:
            # 用 asyncio.wait_for 强制 90s 总超时（httpx read timeout 只限单次读取间隔，
            # 流式响应持续有 chunk 时不触发，需 wait_for 限制总时长，防真卡死）
            resp = await asyncio.wait_for(client.post(url, headers=headers, json=payload), timeout=90.0)
    except asyncio.TimeoutError:
        logger.warning("AI 识别调用总耗时超 90s")
        raise MiniMaxError("AI 识别超时，请稍后重试") from None
    except httpx.HTTPError as exc:
        logger.error("调用 AI 识别 API 网络错误: %s", exc)
        raise MiniMaxError(f"调用 AI 识别 API 网络错误: {exc}") from exc

    if resp.status_code != 200:
        body = resp.text[:300] if resp.text else ""
        logger.error("AI 识别 API 返回非 200: %s, 响应: %s", resp.status_code, body)
        raise MiniMaxError(
            f"AI 识别 API 返回非 200 状态码: {resp.status_code}, 响应: {body}"
        )

    try:
        data = resp.json()
    except json.JSONDecodeError as exc:
        raise MiniMaxError(f"解析 AI 识别响应失败: {exc}") from exc

    content, truncated = _extract_text(data, provider)
    if truncated:
        logger.warning(
            "AI 识别输出因 max_tokens 截断，原始内容: %r", content[:300]
        )

    guesses = _parse_guesses(content)
    if not guesses:
        logger.error("无法从模型输出中解析候选词，原始内容: %r", content[:500])
        raise MiniMaxError("无法从模型输出中解析候选词")

    # 按置信度降序
    guesses.sort(key=lambda g: g.confidence, reverse=True)
    return guesses


def _build_openai_recognize_request(image_base64: str) -> tuple[str, dict[str, str], dict[str, Any]]:
    """构造 OpenAI 兼容端点（qwen）的识别请求。"""
    url = f"{settings.minimax_base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.minimax_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.minimax_model,
        "messages": _build_messages(image_base64),
        # minimax-m3 是推理模型，会先输出 reasoning_content 再输出 content；
        # 200 过小会导致 content 被截断（finish_reason=length），JSON 不完整无法解析。
        "max_tokens": 1024,
        "temperature": 0.7,
    }
    return url, headers, payload


def _build_anthropic_recognize_request(image_base64: str) -> tuple[str, dict[str, str], dict[str, Any]]:
    """构造 Anthropic 协议端点（minimax）的识别请求。"""
    url = f"{settings.minimax_anthropic_base_url}/v1/messages"
    headers = {
        "x-api-key": settings.minimax_anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    media_type, raw_b64 = _to_jpeg_normalized(image_base64)
    # Anthropic 图片用 source.base64 结构（非 image_url data URI）
    content: list[dict[str, Any]] = [
        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": raw_b64}},
        {"type": "text", "text": RECOGNIZE_PROMPT},
    ]
    payload = {
        "model": settings.minimax_anthropic_model,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": content}],
    }
    return url, headers, payload


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
        truncated = data.get("stop_reason") == "max_tokens"
        return text, truncated

    # OpenAI 兼容格式
    choices = data.get("choices") or []
    if not choices:
        return "", False
    choice = choices[0]
    content = choice.get("message", {}).get("content", "")
    if isinstance(content, list):
        content = "".join(
            part.get("text", "") for part in content if isinstance(part, dict)
        )
    return content or "", choice.get("finish_reason") == "length"
