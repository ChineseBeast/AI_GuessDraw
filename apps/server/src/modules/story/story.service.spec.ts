import { StoryService } from './story.service';

describe('StoryService', () => {
  let service: StoryService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new StoryService();
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('starts a three-chapter fallback story', async () => {
    const progress = await service.start('fantasy');
    expect(progress.status).toBe('playing');
    expect(progress.chapters).toHaveLength(3);
    expect(progress.chapters[0].isUnlocked).toBe(true);
    expect(progress.chapters[1].isUnlocked).toBe(false);
  });

  it('advances chapters and completes the story', async () => {
    const started = await service.start('space');
    const image = 'data:image/png;base64,' + 'a'.repeat(10_000);

    const first = await service.submit(started.storyId, 1, image);
    expect(first.progress.currentChapter).toBe(2);
    expect(first.progress.chapters[1].isUnlocked).toBe(true);

    await service.submit(started.storyId, 2, image);
    const final = await service.submit(started.storyId, 3, image);
    expect(final.isComplete).toBe(true);
    expect(final.progress.status).toBe('completed');
    expect(final.ending).toBeTruthy();
    expect(final.progress.drawings).toHaveLength(3);
  });

  it('rejects out-of-order and duplicate submissions', async () => {
    const started = await service.start('underwater');
    const image = 'data:image/png;base64,' + 'a'.repeat(500);

    await expect(service.submit(started.storyId, 2, image)).rejects.toThrow('INVALID_CHAPTER_ORDER');
    await service.submit(started.storyId, 1, image);
    await expect(service.submit(started.storyId, 1, image)).rejects.toThrow('INVALID_CHAPTER_ORDER');
  });
});
