import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point, CanvasStroke, BrushConfig } from '@draw-guess/shared';
import { MAX_UNDO_STEPS } from '@draw-guess/shared';
import type { ToolState } from './Canvas.types';
import { renderCanvas, getCanvasCoords, setBrushStyle, drawStroke } from './Canvas.utils';

let strokeIdCounter = 0;
function nextStrokeId(): string {
  strokeIdCounter += 1;
  return `stroke_${strokeIdCounter}_${Date.now()}`;
}

interface UseDrawingOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  toolState: ToolState;
  readOnly: boolean;
  onStrokeComplete?: (stroke: CanvasStroke) => void;
}

/**
 * 绘画交互 hook — 处理 pointer events
 */
export function useDrawing({ canvasRef, toolState, readOnly, onStrokeComplete }: UseDrawingOptions) {
  const isDrawing = useRef(false);
  const currentPoints = useRef<Point[]>([]);
  const currentBrush = useRef<BrushConfig>({
    color: toolState.activeColor,
    width: toolState.activeBrushWidth,
    opacity: 1,
  });

  // 更新当前画笔配置
  currentBrush.current = {
    color: toolState.activeColor,
    width: toolState.activeBrushWidth,
    opacity: 1,
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (readOnly) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      isDrawing.current = true;
      const point = getCanvasCoords(canvas, e.clientX, e.clientY);
      currentPoints.current = [point];

      // 绘制初始点
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      setBrushStyle(ctx, toolState);

      // 捕获指针以确保 move/up 事件在画布外也能触发
      canvas.setPointerCapture(e.pointerId);
    },
    [canvasRef, toolState, readOnly]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current || readOnly) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const point = getCanvasCoords(canvas, e.clientX, e.clientY);
      currentPoints.current.push(point);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 实时绘制到画布上（不记录为 stroke，等 pointerup 时统一记录）
      setBrushStyle(ctx, toolState);
      drawStroke(ctx, {
        id: 'temp',
        points: currentPoints.current,
        brush: currentBrush.current,
        tool: toolState.activeTool,
        timestamp: Date.now(),
      });
    },
    [canvasRef, toolState, readOnly]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current || readOnly) return;

      isDrawing.current = false;
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.releasePointerCapture(e.pointerId);

      if (currentPoints.current.length === 0) return;

      const stroke: CanvasStroke = {
        id: nextStrokeId(),
        points: [...currentPoints.current],
        brush: { ...currentBrush.current },
        tool: toolState.activeTool,
        timestamp: Date.now(),
      };

      currentPoints.current = [];
      onStrokeComplete?.(stroke);
    },
    [canvasRef, toolState, readOnly, onStrokeComplete]
  );

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}

interface UseHistoryOptions {
  strokes: CanvasStroke[];
  setStrokes: React.Dispatch<React.SetStateAction<CanvasStroke[]>>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
}

/**
 * 撤销/重做 hook
 */
export function useHistory({ strokes, setStrokes, canvasRef, width, height }: UseHistoryOptions) {
  const [undoneStrokes, setUndoneStrokes] = useState<CanvasStroke[]>([]);

  const pushStroke = useCallback(
    (stroke: CanvasStroke) => {
      setStrokes((prev) => {
        const next = [...prev, stroke];
        // 限制最大笔画数
        if (next.length > MAX_UNDO_STEPS * 2) {
          return next.slice(-MAX_UNDO_STEPS * 2);
        }
        return next;
      });
      // 新笔画清空重做栈
      setUndoneStrokes([]);
    },
    [setStrokes]
  );

  const undo = useCallback(() => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;

      const lastStroke = prev[prev.length - 1];
      const newStrokes = prev.slice(0, -1);

      setUndoneStrokes((prev2) => {
        if (prev2.length >= MAX_UNDO_STEPS) {
          return [...prev2.slice(1), lastStroke];
        }
        return [...prev2, lastStroke];
      });

      // 重绘画布
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderCanvas(ctx, newStrokes, width, height);
        }
      }

      return newStrokes;
    });
  }, [canvasRef, width, height]);

  const redo = useCallback(() => {
    setUndoneStrokes((prev) => {
      if (prev.length === 0) return prev;

      const restored = prev[prev.length - 1];
      const newUndone = prev.slice(0, -1);

      setStrokes((prevStrokes) => {
        const newStrokes = [...prevStrokes, restored];

        // 重绘画布
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            renderCanvas(ctx, newStrokes, width, height);
          }
        }

        return newStrokes;
      });

      return newUndone;
    });
  }, [canvasRef, width, height]);

  const clear = useCallback(() => {
    setStrokes([]);
    setUndoneStrokes([]);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderCanvas(ctx, [], width, height);
      }
    }
  }, [canvasRef, width, height]);

  return {
    strokes,
    undoneStrokes,
    pushStroke,
    undo,
    redo,
    clear,
    canUndo: strokes.length > 0,
    canRedo: undoneStrokes.length > 0,
  };
}

interface UseKeyboardShortcutsOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  undo: () => void;
  redo: () => void;
  /** 是否启用（readOnly 模式下禁用） */
  enabled: boolean;
}

/**
 * 键盘快捷键 hook — Ctrl+Z 撤销, Ctrl+Y / Ctrl+Shift+Z 重做
 * 仅在容器有焦点且非输入元素时触发
 */
export function useKeyboardShortcuts({ containerRef, undo, redo, enabled }: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 不干扰输入框中的操作
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && !e.shiftKey && e.key === 'z') {
        // Ctrl+Z → 撤销
        e.preventDefault();
        undo();
      } else if (ctrl && e.key === 'y') {
        // Ctrl+Y → 重做
        e.preventDefault();
        redo();
      } else if (ctrl && e.shiftKey && e.key === 'z') {
        // Ctrl+Shift+Z → 重做
        e.preventDefault();
        redo();
      } else if (ctrl && e.shiftKey && e.key === 'Z') {
        // Ctrl+Shift+Z (大写) → 重做
        e.preventDefault();
        redo();
      }
    };

    const container = containerRef.current;
    container?.addEventListener('keydown', handleKeyDown);
    return () => {
      container?.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, undo, redo, enabled]);
}
