import React, { useRef, useCallback, useEffect } from 'react';
import { Canvas, type CanvasRef } from '@draw-guess/ui';
import type { ToolState } from '@draw-guess/ui';
import { DEFAULT_TOOL_STATE } from '@draw-guess/ui';
import type { CanvasStroke } from '@draw-guess/shared';
import type { ExternalStroke } from '@draw-guess/ui';
import { Toolbar } from '../../singleplayer/components/Toolbar';

interface CanvasViewProps {
  isDrawer: boolean;
  connected: boolean;
  strokes: CanvasStroke[];
  onStrokeComplete?: (stroke: CanvasStroke) => void;
  onUndo?: () => void;
  onClear?: () => void;
}

/**
 * 联机画布视图 — 集成共享 Canvas 组件 + 笔画同步
 */
export const CanvasView: React.FC<CanvasViewProps> = ({
  isDrawer,
  connected,
  strokes,
  onStrokeComplete,
  onUndo,
  onClear,
}) => {
  const canvasRef = useRef<CanvasRef>(null);
  const [toolState, setToolState] = React.useState<ToolState>(DEFAULT_TOOL_STATE);
  const prevStrokesLengthRef = useRef(0);

  // 处理笔画完成
  const handleStrokeComplete = useCallback(
    (stroke: CanvasStroke) => {
      onStrokeComplete?.(stroke);
    },
    [onStrokeComplete]
  );

  // 猜词者/观众：将同步的笔画渲染到画布上
  useEffect(() => {
    if (!isDrawer && canvasRef.current) {
      const externalStrokes: ExternalStroke[] = strokes.map((s) => ({
        points: s.points,
        color: s.brush.color,
        width: s.brush.width,
        tool: s.tool,
      }));
      canvasRef.current.loadStrokes(externalStrokes, { animate: false });
    }
  }, [strokes, isDrawer]);

  // 新回合开始：清空画布（Canvas 组件内部笔画不清空会导致残留）
  useEffect(() => {
    if (strokes.length === 0 && canvasRef.current) {
      canvasRef.current.clear();
      prevStrokesLengthRef.current = 0;
    }
  }, [strokes.length]);

  return (
    <div>
      <Canvas
        ref={canvasRef}
        readOnly={!isDrawer}
        toolState={toolState}
        onToolChange={setToolState}
        onStrokesChange={(newStrokes) => {
          // 仅在绘画者端触发，且仅当笔画数增加时才发送（避免撤销/清空时重复发送）
          if (isDrawer && newStrokes.length > prevStrokesLengthRef.current) {
            const lastStroke = newStrokes[newStrokes.length - 1];
            handleStrokeComplete(lastStroke);
          }
          prevStrokesLengthRef.current = newStrokes.length;
        }}
      />

      {/* 工具栏（仅绘画者可见） */}
      {isDrawer && (
        <div style={{ marginTop: '0.75rem' }}>
          <Toolbar
            toolState={toolState}
            onToolChange={setToolState}
            canUndo={(canvasRef.current?.getStrokeCount() ?? 0) > 0}
            canRedo={(canvasRef.current?.getUndoCount() ?? 0) > 0}
            onUndo={() => {
              canvasRef.current?.undo();
              onUndo?.();
            }}
            onRedo={() => canvasRef.current?.redo()}
            onClear={() => {
              canvasRef.current?.clear();
              onClear?.();
            }}
            disabled={!connected}
          />
        </div>
      )}
    </div>
  );
};
