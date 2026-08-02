# API Contract: AI 识别服务

**Feature**: 003-single-player-canvas | **Version**: 1.0.0

---

## POST /api/singleplayer/recognize

提交画布图片，AI 识别并返回猜测结果。

### Request

```http
POST /api/singleplayer/recognize
Content-Type: application/json
```

```json
{
  "image": "data:image/png;base64,iVBORw0KGgo...",
  "targetWord": "苹果",
  "difficulty": "easy"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | string | ✅ | Base64 编码的 PNG 图片，含 `data:image/png;base64,` 前缀 |
| targetWord | string | ✅ | 当前回合的目标词，后端用于判定 AI 是否猜对 |
| difficulty | string | ✅ | 难度：`easy` \| `medium` \| `hard` |

### Response (200 OK — AI 猜对)

```json
{
  "guesses": [
    { "word": "苹果", "confidence": 0.92 },
    { "word": "水果", "confidence": 0.78 },
    { "word": "番茄", "confidence": 0.45 }
  ],
  "isCorrect": true,
  "matchedGuess": { "word": "苹果", "confidence": 0.92 },
  "processingTime": 342
}
```

### Response (200 OK — AI 猜错)

```json
{
  "guesses": [
    { "word": "橙子", "confidence": 0.65 },
    { "word": "气球", "confidence": 0.42 },
    { "word": "太阳", "confidence": 0.31 }
  ],
  "isCorrect": false,
  "processingTime": 289
}
```

### Response (503 — AI 服务不可用)

```json
{
  "error": "AI_SERVICE_UNAVAILABLE",
  "message": "AI 服务暂时不可用，请稍后重试"
}
```

### Response (400 — 参数错误)

```json
{
  "error": "INVALID_REQUEST",
  "message": "缺少必填参数: image"
}
```

---

## Mock 实现规范

在真实 AI 服务就绪前，后端提供 mock 实现：

### Mock 算法

```typescript
function mockRecognize(targetWord: string, difficulty: Difficulty): AIRecognizeResponse {
  const successRates = { easy: 0.80, medium: 0.60, hard: 0.40 };
  const success = Math.random() < successRates[difficulty];
  
  const delay = 200 + Math.random() * 600; // 200-800ms
  // Simulated async delay handled by NestJS
  
  if (success) {
    return {
      guesses: [
        { word: targetWord, confidence: 0.85 + Math.random() * 0.14 },
        { word: getSimilarWord(targetWord), confidence: 0.6 + Math.random() * 0.3 },
        { word: getRandomWord(), confidence: 0.3 + Math.random() * 0.3 },
      ],
      isCorrect: true,
      matchedGuess: { word: targetWord, confidence: 0.85 + Math.random() * 0.14 },
      processingTime: delay,
    };
  }
  
  return {
    guesses: [
      { word: getRandomWord(), confidence: 0.5 + Math.random() * 0.4 },
      { word: getRandomWord(), confidence: 0.3 + Math.random() * 0.4 },
      { word: getRandomWord(), confidence: 0.1 + Math.random() * 0.3 },
    ],
    isCorrect: false,
    processingTime: delay,
  };
}
```

### Mock 行为约束

| 场景 | 行为 |
|------|------|
| 空图片 | 返回 400 INVALID_REQUEST |
| 超大图片 (>5MB Base64) | 返回 400 IMAGE_TOO_LARGE |
| 模拟超时 | 5% 概率返回 503（测试降级逻辑） |
| 正常请求 | 200-800ms 延迟，按难度返回不同准确率 |

---

## POST /api/singleplayer/word

获取一个随机目标词（用于新一轮）。

### Request

```http
POST /api/singleplayer/word
Content-Type: application/json
```

```json
{
  "difficulty": "medium",
  "excludeWords": ["苹果", "香蕉"]
}
```

### Response (200)

```json
{
  "word": "大象",
  "difficulty": "medium"
}
```

---

## 错误码汇总

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_REQUEST | 400 | 请求参数缺失或格式错误 |
| IMAGE_TOO_LARGE | 400 | 图片超过 5MB |
| AI_SERVICE_UNAVAILABLE | 503 | AI 服务不可用 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
