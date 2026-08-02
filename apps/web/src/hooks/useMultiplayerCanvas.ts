import { useRef, useCallback, useEffect, useState } from 'react';
import type { CanvasStroke, CanvasSyncEvent, Point } from '@draw-guess/shared';

interface UseMultiplayerCanvasOptions {
  on: <T>(event: string, handler: (data: T) => void) => () => void;
  emit: (event: string, payload?: Record<string, unknown>) => void;
  isDrawer: boolean;
  connected: boolean;
}

/**
 * 联机画布 Hook — 处理 canvas_sync 事件和 canvas_action 发送
 */
export function useMultiplayerCanvas({ on, emit, isDrawer, connected }: UseMultiplayerCanvasOptions) {
  const [strokes, setStrokes] = useState<CanvasStroke[]>([]);
  const sequenceRef = useRef(0);
  const strokeBufferRef = useRef<CanvasStroke[]>([]);

  // 监听 canvas_sync 事件
  useEffect(() => {
    const unsub = on<CanvasSyncEvent>('canvas_sync', (data) => {
      // 按序列号排序
      if (data.sequenceNumber !== undefined) {
        sequenceRef.current = Math.max(sequenceRef.current, data.sequenceNumber);
      }

      switch (data.type) {
        case 'draw':
        case 'erase': {
          if (data.points && data.brush) {
            const stroke: CanvasStroke = {
              id: `sync_${data.sequenceNumber}_${Date.now()}`,
              points: data.points as Point[],
              brush: {
                color: data.brush.color,
                width: data.brush.size,
                opacity: data.brush.opacity,
              },
              tool: data.type === 'draw' ? 'pen' : 'eraser',
              timestamp: data.timestamp || Date.now(),
            };
            setStrokes((prev) => [...prev, stroke]);
          }
          break;
        }
        case 'undo':
          setStrokes((prev) => prev.slice(0, -1));
          break;
        case 'clear':
          setStrokes([]);
          break;
      }
    });

    return unsub;
  }, [on]);

  // 监听 round_started 清空画布
  useEffect(() => {
    const unsub = on<unknown>('round_started', () => {
      setStrokes([]);
      sequenceRef.current = 0;
      strokeBufferRef.current = [];
    });

    return unsub;
  }, [on]);

  // 发送 canvas_action
  const sendCanvasAction = useCallback(
    (stroke: CanvasStroke) => {
      if (!isDrawer || !connected) return;

      const seq = ++sequenceRef.current;

      emit('canvas_action', {
        type: stroke.tool,
        brush: {
          color: stroke.brush.color,
          size: stroke.brush.width,
          opacity: stroke.brush.opacity,
        },
        points: stroke.points,
      } as unknown as Record<string, unknown>);

      // 本地也添加笔画
      setStrokes((prev) => [...prev, { ...stroke, id: `local_${seq}_${Date.now()}` }]);
    },
    [isDrawer, connected, emit]
  );

  const sendUndo = useCallback(() => {
    if (!isDrawer || !connected) return;
    emit('canvas_action', { type: 'undo' } as unknown as Record<string, unknown>);
    setStrokes((prev) => prev.slice(0, -1));
  }, [isDrawer, connected, emit]);

  const sendClear = useCallback(() => {
    if (!isDrawer || !connected) return;
    emit('canvas_action', { type: 'clear' } as unknown as Record<string, unknown>);
    setStrokes([]);
  }, [isDrawer, connected, emit]);

  return {
    strokes,
    sendCanvasAction,
    sendUndo,
    sendClear,
    clearStrokes: () => setStrokes([]),
  };
}
