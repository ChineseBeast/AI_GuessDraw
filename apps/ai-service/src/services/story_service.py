from __future__ import annotations

from src.schemas import (
    EvaluationResponse,
    GenerateStoryResponse,
    StoryChapterContent,
    EvaluateDrawingRequest,
)
from src.services.minimax_service import MiniMaxError, recognize_drawing


THEME_STORIES: dict[str, tuple[str, list[tuple[str, str, str, str, list[str]]]]] = {
    "fantasy": (
        "雾光森林的守护者",
        [
            ("迷雾中的微光", "你在会发光的森林边缘醒来，一盏熄灭的灯笼正在等待新的火种。", "画一盏能照亮迷雾的魔法灯笼。", "灯笼、光、火种", ["灯笼", "光", "火"]),
            ("树冠上的门", "灯笼的光带你走到古树顶端，一扇没有门把手的木门浮在枝叶之间。", "画一扇藏在古树枝叶间的魔法门。", "古树、门、枝叶", ["树", "门", "枝叶"]),
            ("星种归来", "门后是一颗失去光芒的星种。森林的命运取决于你如何把它送回夜空。", "画一颗正在回到夜空的星种，并为它画出回家的路。", "星星、夜空、道路", ["星", "夜空", "路"]),
        ],
    ),
    "space": (
        "失重航线的最后信号",
        [
            ("红色求救信号", "你的探测船收到一段来自未知星球的红色求救信号，导航屏上只剩最后一格能量。", "画出一艘正在发射求救信号的太空探测船。", "飞船、信号、星球", ["船", "信号", "星"]),
            ("环形空间站", "你抵达环形空间站，失联的机器人把一张半透明星图投影在舷窗上。", "画一座环形空间站和它投射出的星图。", "空间站、星图、舷窗", ["空间站", "星", "窗"]),
            ("回家的航线", "星图指向一条穿过彩色星云的航线。你必须画出正确路线，才能把机器人带回家。", "画一条穿过星云、通向家园的航线。", "星云、航线、家园", ["星云", "路", "家"]),
        ],
    ),
    "underwater": (
        "深海灯塔的歌",
        [
            ("沉睡的珊瑚城", "潜水艇降落在深海，珊瑚城的灯光一盏接一盏熄灭，只有一枚贝壳还在歌唱。", "画一座有发光珊瑚和贝壳的海底城市。", "珊瑚、贝壳、城市", ["珊瑚", "贝壳", "城"]),
            ("鲸鱼的地图", "一头温柔的鲸鱼带来海流地图，地图上标着一座被漩涡守护的灯塔。", "画一头带着海流地图游向灯塔的鲸鱼。", "鲸鱼、地图、灯塔", ["鲸", "地图", "灯塔"]),
            ("点亮海沟", "灯塔就在海沟深处。只要画出它的光束，整座珊瑚城就能重新听见海洋的歌。", "画一座向海底发出光束的深海灯塔。", "灯塔、光束、海沟", ["灯塔", "光", "海"]),
        ],
    ),
}


def generate_story(theme: str) -> GenerateStoryResponse:
    if theme not in THEME_STORIES:
        raise ValueError("INVALID_THEME")

    title, raw_chapters = THEME_STORIES[theme]
    chapters = [
        StoryChapterContent(
            id=f"{theme}-chapter-{index}",
            chapterNumber=index,
            title=chapter_title,
            narrative=narrative,
            illustrationPrompt=illustration_prompt,
            drawingPrompt=drawing_prompt,
            keyElements=key_elements,
        )
        for index, (chapter_title, narrative, drawing_prompt, illustration_prompt, key_elements) in enumerate(raw_chapters, 1)
    ]
    return GenerateStoryResponse(title=title, chapters=chapters)


def _branch(score: int) -> tuple[int, str]:
    if score >= 80:
        return 3, "positive"
    if score >= 60:
        return 2, "neutral"
    return 1, "alternative"


async def evaluate_drawing(request: EvaluateDrawingRequest) -> EvaluationResponse:
    if not request.image.startswith("data:image/") or len(request.image) < 100:
        raise ValueError("INVALID_IMAGE")

    recognized: list[str] = []
    mode = "fallback"
    score = min(68, 45 + len(request.image) // 2000)

    try:
        guesses = await recognize_drawing(request.image, request.provider)
        for guess in guesses:
            guess_text = guess.word.strip().lower()
            for element in request.keyElements:
                if element.lower() in guess_text or guess_text in element.lower():
                    if element not in recognized:
                        recognized.append(element)
                    score += 24 + int(guess.confidence * 8)
        if guesses:
            score += 8
        mode = "ai"
    except (MiniMaxError, Exception):
        mode = "fallback"

    score = max(0, min(100, score))
    stars, branch_type = _branch(score)
    if branch_type == "positive":
        feedback = "关键元素清晰可见，画作点亮了故事的下一条线索。"
        next_narrative = "你的画作与世界产生共鸣，一条明亮的道路在前方展开。"
    elif branch_type == "neutral":
        feedback = "冒险保留了希望，还有一些细节等待你在下一章补全。"
        next_narrative = "线索若隐若现，但微弱的回应仍然指向前方。"
    else:
        feedback = "画面打开了意外的方向，故事将沿着一条未知的小路继续。"
        next_narrative = "计划之外的力量被唤醒，新的危险也带来了新的机会。"

    return EvaluationResponse(
        score=score,
        stars=stars,
        feedback=feedback,
        recognizedElements=recognized,
        nextNarrative=next_narrative,
        branchType=branch_type,
        evaluationMode=mode,
    )
