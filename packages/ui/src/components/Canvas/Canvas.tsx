import React, { useRef, useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import type { CanvasStroke } from '@draw-guess/shared';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@draw-guess/shared';
import type { CanvasProps, CanvasRef, ToolState } from './Canvas.types';
import { DEFAULT_TOOL_STATE } from './Canvas.types';
import { useDrawing, useHistory, useKeyboardShortcuts } from './Canvas.hooks';
import { renderCanvas } from './Canvas.utils';

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

  const { pushStroke, undo, redo, clear, undoneStrokes } = useHistory({
    strokes,
    setStrokes,
    canvasRef,
    width,
    height,
  });

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
    }),
    [clear, undo, redo, strokes.length, undoneStrokes.length]
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

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio: `${width} / ${height}`,
    overflow: 'hidden',
    outline: 'none',
  };

  const canvasStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'block',
    cursor: readOnly ? 'default' : toolState.activeTool === 'eraser' ? 'cell' : 'crosshair',
    borderRadius: '8px',
    border: '2px solid #333',
    background: '#FFFFFF',
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
