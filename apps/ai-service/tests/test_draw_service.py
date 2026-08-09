import unittest

from src.services.draw_service import (
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    DRAW_PROMPT,
    DRAW_PROMPT_TEMPLATE,
    _parse_strokes,
)


class DrawingPromptTests(unittest.TestCase):
    def test_planning_prompt_requires_structured_semantic_plan(self):
        for constraint in (
            '"subject"',
            '"view"',
            '"silhouette"',
            '"composition"',
            '"parts"',
            '"relation"',
            '"priority"',
            '"avoid"',
            "3~5 个真正具有区分度的视觉部件",
            "只返回一个合法 JSON 对象",
        ):
            self.assertIn(constraint, DRAW_PROMPT_TEMPLATE)

    def test_stroke_prompt_enforces_recognizable_geometry(self):
        prompt = DRAW_PROMPT.replace("{stroke_count}", "8~15")
        for constraint in (
            "x=60~740、y=50~550",
            "60%~75%",
            "连接和对称关系",
            "主体外轮廓 → 最大识别部件",
            "最后一个点必须与第一个点相同",
            "priority 为 1",
            "文字、字母、数字、标签、箭头",
            "只返回一个合法 JSON 数组",
            "8~15 条笔画",
        ):
            self.assertIn(constraint, prompt)


class StrokeParsingTests(unittest.TestCase):
    def test_parser_clamps_model_coordinates_to_canvas(self):
        strokes = _parse_strokes(
            '[{"points":[[-10,700],[900,-20]],"color":"#000000","width":4}]'
        )

        self.assertEqual(len(strokes), 1)
        self.assertEqual(strokes[0].points[0].x, 0)
        self.assertEqual(strokes[0].points[0].y, CANVAS_HEIGHT)
        self.assertEqual(strokes[0].points[1].x, CANVAS_WIDTH)
        self.assertEqual(strokes[0].points[1].y, 0)


if __name__ == "__main__":
    unittest.main()
