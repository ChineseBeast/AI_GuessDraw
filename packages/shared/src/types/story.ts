/** 故事主题 */
export type StoryTheme = 'fantasy' | 'space' | 'underwater';

/** 故事章节 */
export interface StoryChapter {
  id: string;
  chapterNumber: number;
  title: string;
  narrative: string;
  illustrationPrompt: string;
  drawingPrompt: string;
  isCompleted: boolean;
  isUnlocked: boolean;
}

/** 绘画评价 */
export interface DrawingEvaluation {
  score: number;
  feedback: string;
  nextNarrative: string;
  branchType: 'positive' | 'neutral' | 'alternative';
}

/** 故事进度 */
export interface StoryProgress {
  storyId: string;
  theme: StoryTheme;
  currentChapter: number;
  totalChapters: number;
  chapters: StoryChapter[];
  drawings: StoryDrawing[];
  startedAt: string;
  updatedAt: string;
}

/** 故事画作 */
export interface StoryDrawing {
  chapterId: string;
  imageUrl: string;
  evaluation: DrawingEvaluation;
  createdAt: string;
}
