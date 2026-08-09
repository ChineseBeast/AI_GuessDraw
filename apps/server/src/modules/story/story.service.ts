import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';
import type {
  DrawingEvaluation,
  Provider,
  StoryChapter,
  StoryProgress,
  StoryTheme,
  SubmitStoryChapterResponse,
} from '@draw-guess/shared';

interface StoryContent {
  title: string;
  chapters: Omit<StoryChapter, 'isCompleted' | 'isUnlocked'>[];
}

const AI_SERVICE_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, '') || 'http://localhost:8000';
const STORY_TIMEOUT_MS = 15_000;
const THEMES: StoryTheme[] = ['fantasy', 'space', 'underwater'];

const FALLBACK_CONTENT: Record<StoryTheme, StoryContent> = {
  fantasy: {
    title: '雾光森林的守护者',
    chapters: [
      { id: 'fantasy-chapter-1', chapterNumber: 1, title: '迷雾中的微光', narrative: '你在会发光的森林边缘醒来，一盏熄灭的灯笼正在等待新的火种。', illustrationPrompt: '灯笼、光、火种', drawingPrompt: '画一盏能照亮迷雾的魔法灯笼。', keyElements: ['灯笼', '光', '火'] },
      { id: 'fantasy-chapter-2', chapterNumber: 2, title: '树冠上的门', narrative: '灯笼的光带你走到古树顶端，一扇没有门把手的木门浮在枝叶之间。', illustrationPrompt: '古树、门、枝叶', drawingPrompt: '画一扇藏在古树枝叶间的魔法门。', keyElements: ['树', '门', '枝叶'] },
      { id: 'fantasy-chapter-3', chapterNumber: 3, title: '星种归来', narrative: '门后是一颗失去光芒的星种。森林的命运取决于你如何把它送回夜空。', illustrationPrompt: '星星、夜空、道路', drawingPrompt: '画一颗正在回到夜空的星种，并为它画出回家的路。', keyElements: ['星', '夜空', '路'] },
    ],
  },
  space: {
    title: '失重航线的最后信号',
    chapters: [
      { id: 'space-chapter-1', chapterNumber: 1, title: '红色求救信号', narrative: '你的探测船收到一段来自未知星球的红色求救信号，导航屏上只剩最后一格能量。', illustrationPrompt: '飞船、信号、星球', drawingPrompt: '画出一艘正在发射求救信号的太空探测船。', keyElements: ['船', '信号', '星'] },
      { id: 'space-chapter-2', chapterNumber: 2, title: '环形空间站', narrative: '你抵达环形空间站，失联的机器人把一张半透明星图投影在舷窗上。', illustrationPrompt: '空间站、星图、舷窗', drawingPrompt: '画一座环形空间站和它投射出的星图。', keyElements: ['空间站', '星', '窗'] },
      { id: 'space-chapter-3', chapterNumber: 3, title: '回家的航线', narrative: '星图指向一条穿过彩色星云的航线。你必须画出正确路线，才能把机器人带回家。', illustrationPrompt: '星云、航线、家园', drawingPrompt: '画一条穿过星云、通向家园的航线。', keyElements: ['星云', '路', '家'] },
    ],
  },
  underwater: {
    title: '深海灯塔的歌',
    chapters: [
      { id: 'underwater-chapter-1', chapterNumber: 1, title: '沉睡的珊瑚城', narrative: '潜水艇降落在深海，珊瑚城的灯光一盏接一盏熄灭，只有一枚贝壳还在歌唱。', illustrationPrompt: '珊瑚、贝壳、城市', drawingPrompt: '画一座有发光珊瑚和贝壳的海底城市。', keyElements: ['珊瑚', '贝壳', '城'] },
      { id: 'underwater-chapter-2', chapterNumber: 2, title: '鲸鱼的地图', narrative: '一头温柔的鲸鱼带来海流地图，地图上标着一座被漩涡守护的灯塔。', illustrationPrompt: '鲸鱼、地图、灯塔', drawingPrompt: '画一头带着海流地图游向灯塔的鲸鱼。', keyElements: ['鲸', '地图', '灯塔'] },
      { id: 'underwater-chapter-3', chapterNumber: 3, title: '点亮海沟', narrative: '灯塔就在海沟深处。只要画出它的光束，整座珊瑚城就能重新听见海洋的歌。', illustrationPrompt: '灯塔、光束、海沟', drawingPrompt: '画一座向海底发出光束的深海灯塔。', keyElements: ['灯塔', '光', '海'] },
    ],
  },
};

@Injectable()
export class StoryService {
  private readonly stories = new Map<string, StoryProgress>();

  async start(theme: StoryTheme, provider: Provider = 'qwen'): Promise<StoryProgress> {
    this.assertTheme(theme);
    const content = (await this.fetchStory(theme, provider)) ?? FALLBACK_CONTENT[theme];
    const now = new Date().toISOString();
    const storyId = `story_${nanoid(10)}`;
    const progress: StoryProgress = {
      storyId,
      title: content.title,
      theme,
      status: 'playing',
      currentChapter: 1,
      totalChapters: 3,
      totalScore: 0,
      chapters: content.chapters.map((chapter, index) => ({
        ...chapter,
        isCompleted: false,
        isUnlocked: index === 0,
      })),
      drawings: [],
      startedAt: now,
      updatedAt: now,
    };
    this.stories.set(storyId, progress);
    return this.clone(progress);
  }

  getProgress(storyId: string): StoryProgress {
    const progress = this.stories.get(storyId);
    if (!progress) throw new Error('STORY_NOT_FOUND');
    return this.clone(progress);
  }

  async submit(
    storyId: string,
    chapterNumber: number,
    image: string,
    provider: Provider = 'qwen',
  ): Promise<SubmitStoryChapterResponse> {
    const progress = this.stories.get(storyId);
    if (!progress) throw new Error('STORY_NOT_FOUND');
    if (!image?.startsWith('data:image/')) throw new Error('INVALID_IMAGE');
    if (image.length > 7_000_000) throw new Error('IMAGE_TOO_LARGE');
    if (progress.status === 'completed') throw new Error('STORY_COMPLETED');
    if (chapterNumber !== progress.currentChapter) throw new Error('INVALID_CHAPTER_ORDER');

    const chapter = progress.chapters[chapterNumber - 1];
    if (!chapter?.isUnlocked) throw new Error('CHAPTER_LOCKED');
    if (chapter.isCompleted) throw new Error('CHAPTER_ALREADY_COMPLETED');

    const evaluation =
      (await this.fetchEvaluation(progress, chapter, image, provider)) ?? this.fallbackEvaluation(chapter, image);
    chapter.isCompleted = true;
    progress.drawings.push({
      chapterId: chapter.id,
      imageUrl: image,
      evaluation,
      createdAt: new Date().toISOString(),
    });
    progress.totalScore += evaluation.score;

    let ending: string | null = null;
    if (chapterNumber === progress.totalChapters) {
      progress.status = 'completed';
      ending = this.buildEnding(progress.totalScore);
      progress.ending = ending;
    } else {
      const next = progress.chapters[chapterNumber];
      next.isUnlocked = true;
      next.narrative = `${evaluation.nextNarrative}\n\n${next.narrative}`;
      progress.currentChapter += 1;
    }
    progress.updatedAt = new Date().toISOString();
    return { evaluation, progress: this.clone(progress), isComplete: progress.status === 'completed', ending };
  }

  private async fetchStory(theme: StoryTheme, provider: Provider): Promise<StoryContent | null> {
    try {
      const response = await this.request('/api/v1/ai/generate-story', { theme, provider });
      if (!response?.title || !Array.isArray(response.chapters) || response.chapters.length !== 3) return null;
      return response as unknown as StoryContent;
    } catch {
      return null;
    }
  }

  private async fetchEvaluation(
    progress: StoryProgress,
    chapter: StoryChapter,
    image: string,
    provider: Provider,
  ): Promise<DrawingEvaluation | null> {
    try {
      const response = await this.request('/api/v1/ai/evaluate-drawing', {
        image,
        theme: progress.theme,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.title,
        drawingPrompt: chapter.drawingPrompt,
        keyElements: chapter.keyElements,
        provider,
      });
      if (typeof response?.score !== 'number' || !response.feedback) return null;
      return response as unknown as DrawingEvaluation;
    } catch {
      return null;
    }
  }

  private async request(path: string, body: unknown): Promise<Record<string, unknown> | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STORY_TIMEOUT_MS);
    try {
      const response = await fetch(`${AI_SERVICE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private fallbackEvaluation(chapter: StoryChapter, image: string): DrawingEvaluation {
    const score = Math.min(72, 52 + Math.floor(image.length / 10_000));
    const stars: 1 | 2 | 3 = score >= 80 ? 3 : score >= 60 ? 2 : 1;
    const branchType = score >= 80 ? 'positive' : score >= 60 ? 'neutral' : 'alternative';
    return {
      score,
      stars,
      feedback: '本地评审：你为“' + chapter.title + '”画下了继续冒险的线索。',
      recognizedElements: [],
      nextNarrative: '虽然细节仍有想象空间，但你的勇气让冒险继续前进。',
      branchType,
      evaluationMode: 'fallback',
    };
  }

  private buildEnding(score: number): string {
    if (score >= 240) return '传说结局：你的画作点亮了整个世界，成为故事中永远流传的守护者。';
    if (score >= 180) return '希望结局：你带着珍贵的线索回到家园，新的冒险正在悄悄发芽。';
    return '意外结局：旅程没有按照计划结束，但你为未知打开了一扇真正的门。';
  }

  private assertTheme(theme: StoryTheme): void {
    if (!THEMES.includes(theme)) throw new Error('INVALID_THEME');
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
