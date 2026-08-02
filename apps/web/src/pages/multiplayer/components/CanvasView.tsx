import React, { useRef, useCallback } from 'react';
import { Canvas, type CanvasRef } from '@draw-guess/ui';
import type { ToolState } from '@draw-guess/ui';
import { DEFAULT_TOOL_STATE } from '@draw-guess/ui';
import type { CanvasStroke } from '@draw-guess/shared';
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
  onStrokeComplete,
  onUndo,
  onClear,
}) => {
  const canvasRef = useRef<CanvasRef>(null);
  const [toolState, setToolState] = React.useState<ToolState>(DEFAULT_TOOL_STATE);

  // 处理笔画完成
  const handleStrokeComplete = useCallback(
    (stroke: CanvasStroke) => {
      onStrokeComplete?.(stroke);
    },
    [onStrokeComplete]
  );

  // 当 strokes 从外部更新时（canvas_sync 接收），重绘画布
  // 但这里我们依赖 Canvas 组件内部管理笔画，外部 strokes 仅用于同步
  // 实际方案：Canvas 组件管理本地笔画 + 外部 strokes 作为同步源

  return (
    <div>
      <Canvas
        ref={canvasRef}
        readOnly={!isDrawer}
        toolState={toolState}
        onToolChange={setToolState}
        onStrokesChange={(newStrokes) => {
          // 仅在绘画者端触发
          if (isDrawer && newStrokes.length > 0) {
            const lastStroke = newStrokes[newStrokes.length - 1];
            handleStrokeComplete(lastStroke);
          }
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
