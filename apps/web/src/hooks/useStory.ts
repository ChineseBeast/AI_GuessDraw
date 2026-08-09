import { useCallback, useState } from 'react';
import type { DrawingEvaluation, Provider, StoryProgress, StoryTheme } from '@draw-guess/shared';
import { startStory, submitStoryChapter } from '../services/story.service';

export function useStory(provider: Provider = 'qwen') {
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const [evaluation, setEvaluation] = useState<DrawingEvaluation | null>(null);
  const [ending, setEnding] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = useCallback(async (theme: StoryTheme) => {
    setLoading(true);
    setError(null);
    setEvaluation(null);
    setEnding(null);
    try {
      setProgress(await startStory(theme, provider));
    } catch (err) {
      setError(err instanceof Error ? err.message : '故事启动失败');
    } finally {
      setLoading(false);
    }
  }, [provider]);

  const submit = useCallback(async (image: string) => {
    if (!progress) return;
    setLoading(true);
    setError(null);
    try {
      const result = await submitStoryChapter(progress.storyId, progress.currentChapter, image, provider);
      setProgress(result.progress);
      setEvaluation(result.evaluation);
      setEnding(result.ending);
    } catch (err) {
      setError(err instanceof Error ? err.message : '画作提交失败');
    } finally {
      setLoading(false);
    }
  }, [progress, provider]);

  const continueStory = useCallback(() => {
    setEvaluation(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setProgress(null);
    setEvaluation(null);
    setEnding(null);
    setError(null);
  }, []);

  return { progress, evaluation, ending, loading, error, begin, submit, continueStory, reset };
}
