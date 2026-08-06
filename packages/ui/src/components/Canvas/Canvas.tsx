import React, { useRef, useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import type { CanvasStroke } from '@draw-guess/shared';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@draw-guess/shared';
import type { CanvasProps, CanvasRef, ExternalStroke, ToolState } from './Canvas.types';
import { DEFAULT_TOOL_STATE } from './Canvas.types';
import { useDrawing, useHistory, useKeyboardShortcuts } from './Canvas.hooks';
import { drawStroke, renderCanvas } from './Canvas.utils';

export type { CanvasProps, CanvasRef, ToolState };

export const Canvas = forwardRef<CanvasRef, CanvasProps>(function Canvas(
  {
    width = CANVAS_WIDTH,
    height = CANVAS_HEIGHT,
    readOnly = false,
    initialToolState,
    onStrokesChange,
    toolState: externalToolState,
    className,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [internalToolState] = useState<ToolState>({
    ...DEFAULT_TOOL_STATE,
    ...initialToolState,
  });

  // 合并内外部工具状态（当前使用 externalToolState 受控模式）
  const toolState = externalToolState ?? internalToolState;

  // 笔画管理
  const [strokes, setStrokes] = useState<CanvasStroke[]>([]);
  // 动画回放定时器引用（用于在重新加载前清理）
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { pushStroke, undo, redo, clear, undoneStrokes } = useHistory({
    strokes,
    setStrokes,
    canvasRef,
    width,
    height,
  });

  /** 加载外部笔画并逐笔动画绘制（用于 AI 绘画回放） */
  const loadStrokes = React.useCallback(
    (externalStrokes: ExternalStroke[], options?: { animate?: boolean; speed?: number }) => {
      // 清理上一次动画
      if (animTimerRef.current) {
        clearTimeout(animTimerRef.current);
        animTimerRef.current = null;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 转换为内部 CanvasStroke
      const converted: CanvasStroke[] = externalStrokes.map((s, i) => ({
        id: `ai_stroke_${i}_${Date.now()}`,
        points: s.points,
        brush: { color: s.color, width: s.width, opacity: 1 },
        tool: 'pen',
        timestamp: Date.now() + i,
      }));

      // 清空并重置状态
      renderCanvas(ctx, [], width, height);
      setStrokes([]);

      const animate = options?.animate ?? true;
      const speed = options?.speed ?? 80; // 每笔间隔毫秒

      if (!animate || converted.length === 0) {
        // 直接全量渲染
        renderCanvas(ctx, converted, width, height);
        setStrokes(converted);
        return;
      }

      // 逐笔动画：每隔 speed ms 绘制一条笔画
      let index = 0;
      const drawnSoFar: CanvasStroke[] = [];
      const drawNext = () => {
        if (index >= converted.length) {
          animTimerRef.current = null;
          return;
        }
        const stroke = converted[index];
        drawnSoFar.push(stroke);
        drawStroke(ctx, stroke); // 增量绘制单条笔画
        setStrokes([...drawnSoFar]);
        index += 1;
        animTimerRef.current = setTimeout(drawNext, speed);
      };
      drawNext();
    },
    [canvasRef, width, height]
  );

  // 绘画交互
  const { handlePointerDown, handlePointerMove, handlePointerUp } = useDrawing({
    canvasRef,
    toolState,
    readOnly,
    onStrokeComplete: pushStroke,
  });

  // 笔画变更回调
  useEffect(() => {
    onStrokesChange?.(strokes);
  }, [strokes, onStrokesChange]);

  // 初始化画布背景
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderCanvas(ctx, strokes, width, height);
  }, []);

  // 暴露给父组件的方法
  useImperativeHandle(
    ref,
    () => ({
      getImageDataURL: (type = 'image/png', quality = 0.92) => {
        return canvasRef.current?.toDataURL(type, quality) ?? '';
      },
      clear,
      undo,
      redo,
      getStrokeCount: () => strokes.length,
      getUndoCount: () => undoneStrokes.length,
      isEmpty: () => strokes.length === 0,
      loadStrokes,
    }),
    [clear, undo, redo, loadStrokes, strokes.length, undoneStrokes.length]
  );

  // 外部清空（当 readOnly 变化时）
  useEffect(() => {
    if (!readOnly) {
      // 重置绘画状态（画布内容保持）
    }
  }, [readOnly]);

  // 键盘快捷键
  const containerRef = useRef<HTMLDivElement>(null);
  useKeyboardShortcuts({ containerRef, undo, redo, enabled: !readOnly });

  // 边框+圆角放在容器上（而非 canvas），保证圆角处黑边完整不残缺
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: 560,
    margin: '0 auto',
    aspectRatio: `${width} / ${height}`,
    overflow: 'hidden',
    outline: 'none',
    borderRadius: '8px',
    border: '2px solid #333',
    background: '#FFFFFF',
  };

  const canvasStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'block',
    cursor: readOnly ? 'default' : toolState.activeTool === 'eraser' ? 'cell' : 'crosshair',
    touchAction: 'none', // 阻止移动端默认滚动/缩放行为
  };

  return (
    <div ref={containerRef} className={className} style={containerStyle} tabIndex={readOnly ? undefined : 0}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={canvasStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
});
