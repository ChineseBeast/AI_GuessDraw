import type { Provider } from './game.js';

export type StoryTheme = 'fantasy' | 'space' | 'underwater';
export type StoryStatus = 'playing' | 'completed';
export type StoryBranchType = 'positive' | 'neutral' | 'alternative';
export type EvaluationMode = 'ai' | 'fallback';

export interface StoryChapter {
  id: string;
  chapterNumber: number;
  title: string;
  narrative: string;
  illustrationPrompt: string;
  drawingPrompt: string;
  keyElements: string[];
  isCompleted: boolean;
  isUnlocked: boolean;
}

export interface DrawingEvaluation {
  score: number;
  stars: 1 | 2 | 3;
  feedback: string;
  recognizedElements: string[];
  nextNarrative: string;
  branchType: StoryBranchType;
  evaluationMode: EvaluationMode;
}

export interface StoryDrawing {
  chapterId: string;
  imageUrl: string;
  evaluation: DrawingEvaluation;
  createdAt: string;
}

export interface StoryProgress {
  storyId: string;
  title: string;
  theme: StoryTheme;
  status: StoryStatus;
  currentChapter: number;
  totalChapters: 3;
  totalScore: number;
  chapters: StoryChapter[];
  drawings: StoryDrawing[];
  ending?: string;
  startedAt: string;
  updatedAt: string;
}

export interface StartStoryRequest {
  theme: StoryTheme;
  provider?: Provider;
}

export interface SubmitStoryChapterRequest {
  image: string;
  provider?: Provider;
}

export interface SubmitStoryChapterResponse {
  evaluation: DrawingEvaluation;
  progress: StoryProgress;
  isComplete: boolean;
  ending: string | null;
}
