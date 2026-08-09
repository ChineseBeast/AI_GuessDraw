# Data Model: 故事模式

## StoryTheme

```ts
type StoryTheme = 'fantasy' | 'space' | 'underwater';
```

## StoryChapter

| Field | Type | Rules |
|---|---|---|
| id | string | 故事内唯一 |
| chapterNumber | number | 1..3 |
| title | string | 非空 |
| narrative | string | 非空，包含当前剧情 |
| illustrationPrompt | string | 供内容生成使用 |
| drawingPrompt | string | 面向玩家的绘画任务 |
| keyElements | string[] | 1..5 个可识别元素 |
| isCompleted | boolean | 完成后不可再次提交 |
| isUnlocked | boolean | 仅当前及已完成章节为 true |

## DrawingEvaluation

| Field | Type | Rules |
|---|---|---|
| score | number | 整数 0..100 |
| stars | number | 1..3 |
| feedback | string | 非空、面向玩家 |
| recognizedElements | string[] | 可为空 |
| nextNarrative | string | 非空、用于剧情衔接 |
| branchType | enum | positive / neutral / alternative |
| evaluationMode | enum | ai / fallback |

## StoryDrawing

| Field | Type | Rules |
|---|---|---|
| chapterId | string | 指向 StoryChapter |
| imageUrl | string | PNG data URL，MVP 内存保存 |
| evaluation | DrawingEvaluation | 一对一 |
| createdAt | string | ISO 8601 |

## StoryProgress

| Field | Type | Rules |
|---|---|---|
| storyId | string | 服务端生成 |
| title | string | 主题故事标题 |
| theme | StoryTheme | 固定 |
| status | enum | playing / completed |
| currentChapter | number | 1..3 |
| totalChapters | number | 固定 3 |
| totalScore | number | 所有已完成章节 score 之和 |
| chapters | StoryChapter[] | 恰好 3 个 |
| drawings | StoryDrawing[] | 0..3 个 |
| ending | string? | completed 时必填 |
| startedAt | string | ISO 8601 |
| updatedAt | string | ISO 8601 |

## State Transitions

```text
theme_selected
  -> story.playing / chapter 1 unlocked
  -> chapter 1 submitted / chapter 2 unlocked
  -> chapter 2 submitted / chapter 3 unlocked
  -> chapter 3 submitted / story.completed + ending
```

无论评价分支为何，章节均可推进；分数只影响衔接文本和结局语气。
