import React, { useMemo, useRef, useState } from 'react';
import type { Provider, StoryTheme } from '@draw-guess/shared';
import {
  Canvas,
  DEFAULT_TOOL_STATE,
  type CanvasRef,
  type ToolState,
} from '@draw-guess/ui';
import { useStory } from '../../hooks/useStory';

interface StoryPageProps {
  onNavigateHome: () => void;
}

const THEMES: { id: StoryTheme; title: string; description: string; accent: string }[] = [
  { id: 'fantasy', title: '奇幻森林', description: '点亮迷雾中的魔法线索', accent: '#7c3aed' },
  { id: 'space', title: '失重航线', description: '绘制穿过星云的回家路线', accent: '#2563eb' },
  { id: 'underwater', title: '深海灯塔', description: '让沉睡的珊瑚城重新歌唱', accent: '#0891b2' },
];

const provider: Provider = 'minimax';

export const StoryPage: React.FC<StoryPageProps> = ({ onNavigateHome }) => {
  const story = useStory(provider);
  const canvasRef = useRef<CanvasRef>(null);
  const [toolState, setToolState] = useState<ToolState>(DEFAULT_TOOL_STATE);
  const [submittedChapter, setSubmittedChapter] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const activeChapter = story.progress
    ? story.progress.chapters[story.progress.currentChapter - 1]
    : null;
  const completedChapter = submittedChapter
    ? story.progress?.chapters[submittedChapter - 1]
    : null;
  const completed = story.progress?.status === 'completed';
  const stars = useMemo(
    () => story.evaluation
      ? '★'.repeat(story.evaluation.stars) + '☆'.repeat(3 - story.evaluation.stars)
      : '',
    [story.evaluation],
  );

  const handleSubmit = async () => {
    if (!canvasRef.current || canvasRef.current.isEmpty()) {
      setLocalError('请先在画布上完成一幅画。');
      return;
    }
    setLocalError(null);
    setSubmittedChapter(story.progress?.currentChapter ?? null);
    await story.submit(canvasRef.current.getImageDataURL('image/png'));
  };

  if (!story.progress) {
    return (
      <main style={styles.shell}>
        <header style={styles.header}>
          <button onClick={onNavigateHome} style={styles.linkButton}>← 返回首页</button>
          <span style={styles.eyebrow}>STORY MODE</span>
        </header>
        <section style={styles.intro}>
          <p style={styles.kicker}>AI 叙事绘画冒险</p>
          <h1 style={styles.title}>选择你的故事世界</h1>
          <p style={styles.muted}>每一幅画都会留下线索，三章之后抵达属于你的结局。</p>
        </section>
        <section style={styles.themeGrid} aria-label="故事主题">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => story.begin(theme.id)}
              disabled={story.loading}
              style={{ ...styles.theme, borderTopColor: theme.accent }}
            >
              <span style={{ ...styles.themeDot, background: theme.accent }} />
              <strong>{theme.title}</strong>
              <span style={styles.themeDescription}>{theme.description}</span>
              <span style={{ ...styles.startHint, color: theme.accent }}>
                {story.loading ? '准备中…' : '开始冒险 →'}
              </span>
            </button>
          ))}
        </section>
        {story.error && <p role="alert" style={styles.error}>{story.error}</p>}
      </main>
    );
  }

  if (story.evaluation) {
    return (
      <main style={styles.shell}>
        <header style={styles.header}>
          <button onClick={onNavigateHome} style={styles.linkButton}>← 返回首页</button>
          <span style={styles.progressLabel}>
            {completed ? '冒险完成' : '第 ' + submittedChapter + ' 章完成'}
          </span>
        </header>
        <section style={styles.result}>
          <p style={styles.kicker}>{completed ? 'FINAL CHAPTER' : 'CHAPTER COMPLETE'}</p>
          <h1 style={styles.title}>
            {completed ? '你的故事留下了什么？' : completedChapter?.title}
          </h1>
          <div style={styles.scoreRow}>
            <span style={styles.stars}>{stars}</span>
            <strong>{story.evaluation.score} 分</strong>
          </div>
          <p style={styles.feedback}>{story.evaluation.feedback}</p>
          <p style={styles.narrative}>{story.evaluation.nextNarrative}</p>
          <span style={styles.mode}>
            {story.evaluation.evaluationMode === 'ai' ? 'AI 评审' : '本地评审'}
          </span>
          {completed && story.ending ? <p style={styles.ending}>{story.ending}</p> : null}
          <div style={styles.resultActions}>
            {completed
              ? <button onClick={story.reset} style={styles.primaryButton}>再玩一次</button>
              : <button onClick={story.continueStory} style={styles.primaryButton}>继续前进 →</button>}
            <button onClick={onNavigateHome} style={styles.secondaryButton}>离开故事</button>
          </div>
        </section>
      </main>
    );
  }

  if (!activeChapter) return null;

  return (
    <main style={styles.shell}>
      <header style={styles.header}>
        <button onClick={onNavigateHome} style={styles.linkButton}>← 返回首页</button>
        <span style={styles.progressLabel}>
          {story.progress.title} · {story.progress.currentChapter}/{story.progress.totalChapters}
        </span>
      </header>
      <div style={styles.storyLayout}>
        <section style={styles.storyPanel}>
          <p style={styles.kicker}>CHAPTER {activeChapter.chapterNumber}</p>
          <h1 style={styles.chapterTitle}>{activeChapter.title}</h1>
          <p style={styles.narrative}>{activeChapter.narrative}</p>
          <div style={styles.task}>
            <span style={styles.taskLabel}>绘画任务</span>
            <strong>{activeChapter.drawingPrompt}</strong>
          </div>
          <p style={styles.hint}>关键元素：{activeChapter.keyElements.join(' · ')}</p>
          {(localError || story.error) && (
            <p role="alert" style={styles.error}>{localError || story.error}</p>
          )}
        </section>
        <section style={styles.canvasPanel}>
          <Canvas ref={canvasRef} toolState={toolState} />
          <div style={styles.toolbar}>
            <label>
              颜色{' '}
              <input
                aria-label="画笔颜色"
                type="color"
                value={toolState.activeColor}
                onChange={(event) => setToolState((prev) => ({ ...prev, activeColor: event.target.value }))}
              />
            </label>
            <label>
              粗细{' '}
              <input
                aria-label="画笔粗细"
                type="range"
                min="2"
                max="18"
                value={toolState.activeBrushWidth}
                onChange={(event) => setToolState((prev) => ({ ...prev, activeBrushWidth: Number(event.target.value) }))}
              />
            </label>
            <button onClick={() => canvasRef.current?.undo()} style={styles.toolButton}>撤销</button>
            <button onClick={() => canvasRef.current?.redo()} style={styles.toolButton}>重做</button>
            <button onClick={() => canvasRef.current?.clear()} style={styles.toolButton}>清空</button>
          </div>
          <button onClick={handleSubmit} disabled={story.loading} style={styles.submitButton}>
            {story.loading ? 'AI 正在阅读你的画…' : '提交画作 →'}
          </button>
        </section>
      </div>
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100vh', padding: '24px', maxWidth: '1120px', margin: '0 auto', color: '#172033', background: '#f8fafc' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' },
  linkButton: { border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', padding: '8px 0', fontSize: '14px' },
  eyebrow: { fontSize: '12px', letterSpacing: '2px', color: '#94a3b8', fontWeight: 700 },
  progressLabel: { color: '#64748b', fontSize: '14px' },
  intro: { maxWidth: '620px', marginBottom: '32px' },
  kicker: { color: '#7c3aed', fontSize: '12px', fontWeight: 800, letterSpacing: '1.5px', margin: '0 0 10px' },
  title: { fontSize: 'clamp(32px, 6vw, 56px)', lineHeight: 1.05, margin: '0 0 16px' },
  chapterTitle: { fontSize: 'clamp(28px, 5vw, 44px)', lineHeight: 1.1, margin: '0 0 18px' },
  muted: { color: '#64748b', lineHeight: 1.7, margin: 0 },
  themeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' },
  theme: { textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px', padding: '22px', minHeight: '190px', background: '#fff', border: '1px solid #e2e8f0', borderTop: '4px solid', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(15,23,42,.06)' },
  themeDot: { width: '12px', height: '12px', borderRadius: '50%' },
  themeDescription: { color: '#64748b', fontSize: '14px', lineHeight: 1.5 },
  startHint: { marginTop: 'auto', fontWeight: 700, fontSize: '14px' },
  storyLayout: { display: 'grid', gridTemplateColumns: 'minmax(240px, .85fr) minmax(320px, 1.15fr)', gap: '32px', alignItems: 'start' },
  storyPanel: { paddingTop: '16px' },
  canvasPanel: { display: 'flex', flexDirection: 'column', gap: '14px' },
  task: { marginTop: '28px', display: 'grid', gap: '8px', padding: '16px', background: '#fff', borderLeft: '4px solid #7c3aed', borderRadius: '6px', boxShadow: '0 8px 24px rgba(15,23,42,.05)' },
  taskLabel: { color: '#7c3aed', fontSize: '12px', fontWeight: 800, letterSpacing: '1px' },
  hint: { color: '#94a3b8', fontSize: '13px', marginTop: '18px' },
  narrative: { color: '#475569', lineHeight: 1.8, whiteSpace: 'pre-line', margin: '0 0 18px' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', color: '#64748b', fontSize: '13px' },
  toolButton: { border: '1px solid #cbd5e1', background: '#fff', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#475569' },
  submitButton: { border: 0, borderRadius: '8px', padding: '13px 18px', color: '#fff', background: '#7c3aed', fontWeight: 700, cursor: 'pointer', fontSize: '15px' },
  error: { color: '#b91c1c', background: '#fef2f2', borderRadius: '6px', padding: '10px 12px', fontSize: '13px' },
  result: { maxWidth: '680px', margin: '0 auto', padding: '48px 0', textAlign: 'center' },
  scoreRow: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', fontSize: '24px', margin: '28px 0 18px' },
  stars: { color: '#f59e0b', letterSpacing: '4px', fontSize: '28px' },
  feedback: { fontSize: '18px', color: '#334155', lineHeight: 1.6 },
  mode: { display: 'inline-block', color: '#64748b', fontSize: '12px', padding: '5px 9px', background: '#e2e8f0', borderRadius: '999px' },
  ending: { marginTop: '26px', padding: '18px', background: '#fff', borderRadius: '8px', lineHeight: 1.7, color: '#334155' },
  resultActions: { marginTop: '32px', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' },
  primaryButton: { border: 0, borderRadius: '8px', padding: '12px 20px', color: '#fff', background: '#7c3aed', fontWeight: 700, cursor: 'pointer' },
  secondaryButton: { border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 20px', color: '#475569', background: '#fff', cursor: 'pointer' },
};
