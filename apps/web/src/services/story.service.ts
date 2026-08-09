import type {
  Provider,
  StoryProgress,
  StoryTheme,
  SubmitStoryChapterResponse,
} from '@draw-guess/shared';

const STORY_API = '/api/stories';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(STORY_API + path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const body = (await response.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!response.ok) throw new Error(body?.message ?? '故事服务暂时不可用');
  return body as T;
}

export function startStory(theme: StoryTheme, provider: Provider = 'qwen') {
  return request<StoryProgress>('/start', {
    method: 'POST',
    body: JSON.stringify({ theme, provider }),
  });
}

export function submitStoryChapter(
  storyId: string,
  chapterNumber: number,
  image: string,
  provider: Provider = 'qwen',
) {
  return request<SubmitStoryChapterResponse>(
    '/' + storyId + '/chapters/' + chapterNumber + '/submit',
    { method: 'POST', body: JSON.stringify({ image, provider }) },
  );
}

export function getStoryProgress(storyId: string) {
  return request<StoryProgress>('/' + storyId + '/progress');
}
