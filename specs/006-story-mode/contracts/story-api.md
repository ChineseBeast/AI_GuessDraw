# Contract: Story API

所有 Web 请求由 Vite `/api` 代理到 NestJS `/api/v1`。

## POST /api/v1/stories/start

Request:

```json
{
  "theme": "fantasy",
  "provider": "minimax"
}
```

Response `201`:

```json
{
  "storyId": "story_xxx",
  "title": "雾光森林的守护者",
  "theme": "fantasy",
  "status": "playing",
  "currentChapter": 1,
  "totalChapters": 3,
  "totalScore": 0,
  "chapters": [],
  "drawings": [],
  "startedAt": "2026-08-08T00:00:00.000Z",
  "updatedAt": "2026-08-08T00:00:00.000Z"
}
```

Errors: `400 INVALID_THEME`.

## POST /api/v1/stories/:storyId/chapters/:chapter/submit

Request:

```json
{
  "image": "data:image/png;base64,...",
  "provider": "minimax"
}
```

Response `200`:

```json
{
  "evaluation": {
    "score": 82,
    "stars": 3,
    "feedback": "关键元素清晰可见。",
    "recognizedElements": ["灯笼"],
    "nextNarrative": "灯笼照亮了隐藏的小路。",
    "branchType": "positive",
    "evaluationMode": "ai"
  },
  "progress": {},
  "isComplete": false,
  "ending": null
}
```

Errors:

- `400 INVALID_IMAGE` / `IMAGE_TOO_LARGE`
- `404 STORY_NOT_FOUND`
- `409 CHAPTER_LOCKED` / `CHAPTER_ALREADY_COMPLETED` / `INVALID_CHAPTER_ORDER`

## GET /api/v1/stories/:storyId/progress

Response `200`: `StoryProgress`

Error: `404 STORY_NOT_FOUND`.

## POST /api/v1/ai/generate-story

Internal NestJS → FastAPI contract.

Request: `{ "theme": "fantasy" }`

Response: `{ "title": string, "chapters": StoryChapterContent[3] }`

## POST /api/v1/ai/evaluate-drawing

Internal NestJS → FastAPI contract.

Request:

```json
{
  "image": "data:image/png;base64,...",
  "theme": "fantasy",
  "chapterNumber": 1,
  "chapterTitle": "迷雾中的微光",
  "drawingPrompt": "画一盏能照亮迷雾的魔法灯笼",
  "keyElements": ["灯笼", "光", "迷雾"],
  "provider": "minimax"
}
```

Response: `DrawingEvaluation`。外部模型失败时仍返回 `200`，且 `evaluationMode` 为 `fallback`。
