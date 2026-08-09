import unittest
from unittest.mock import AsyncMock, patch

from src.schemas import EvaluateDrawingRequest
from src.services.minimax_service import MiniMaxError
from src.services.story_service import evaluate_drawing, generate_story


class StoryGenerationTests(unittest.TestCase):
    def test_all_themes_have_three_chapters(self):
        for theme in ("fantasy", "space", "underwater"):
            story = generate_story(theme)
            self.assertTrue(story.title)
            self.assertEqual(len(story.chapters), 3)
            self.assertEqual([chapter.chapterNumber for chapter in story.chapters], [1, 2, 3])

    def test_invalid_theme_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "INVALID_THEME"):
            generate_story("unknown")


class StoryEvaluationTests(unittest.IsolatedAsyncioTestCase):
    @patch(
        "src.services.story_service.recognize_drawing",
        new_callable=AsyncMock,
        side_effect=MiniMaxError("offline"),
    )
    async def test_model_failure_returns_fallback_evaluation(self, _recognize):
        request = EvaluateDrawingRequest(
            image="data:image/png;base64," + ("a" * 5000),
            theme="fantasy",
            chapterNumber=1,
            chapterTitle="迷雾中的微光",
            drawingPrompt="画一盏魔法灯笼",
            keyElements=["灯笼", "光"],
            provider="qwen",
        )
        evaluation = await evaluate_drawing(request)
        self.assertEqual(evaluation.evaluationMode, "fallback")
        self.assertGreaterEqual(evaluation.score, 0)
        self.assertLessEqual(evaluation.score, 100)
        self.assertIn(evaluation.branchType, ("positive", "neutral", "alternative"))


if __name__ == "__main__":
    unittest.main()
