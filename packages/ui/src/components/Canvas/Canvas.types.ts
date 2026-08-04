import type { CanvasStroke, Point } from '@draw-guess/shared';

/** 外部笔画（用于 AI 绘画回放，简化结构） */
export interface ExternalStroke {
  points: Point[];
  color: string;
  width: number;
}

/** 工具栏状态 */
export interface ToolState {
  activeTool: 'pen' | 'eraser';
  activeColor: string;
  activeBrushWidth: number;
}

/** 画布组件内部状态 */
export interface CanvasComponentState {
  strokes: CanvasStroke[];
  undoneStrokes: CanvasStroke[];
  toolState: ToolState;
  isEmpty: boolean;
}

/** 画布组件 Props */
export interface CanvasProps {
  /** 画布宽度（逻辑像素） */
  width?: number;
  /** 画布高度（逻辑像素） */
  height?: number;
  /** 是否只读（提交后禁止绘画） */
  readOnly?: boolean;
  /** 初始画笔配置 */
  initialToolState?: Partial<ToolState>;
  /** 笔画变更回调 */
  onStrokesChange?: (strokes: CanvasStroke[]) => void;
  /** 工具变更回调 */
  onToolChange?: (toolState: ToolState) => void;
  /** 外部控制的工具状态（受控模式） */
  toolState?: ToolState;
  /** 自定义类名 */
  className?: string;
}

/** 画布组件 Ref */
export interface CanvasRef {
  /** 获取画布 DataURL */
  getImageDataURL: (type?: string, quality?: number) => string;
  /** 清空画布 */
  clear: () => void;
  /** 撤销 */
  undo: () => void;
  /** 重做 */
  redo: () => void;
  /** 获取当前笔画数 */
  getStrokeCount: () => number;
  /** 获取撤销栈深度 */
  getUndoCount: () => number;
  /** 画布是否为空 */
  isEmpty: () => boolean;
  /** 加载外部笔画并逐笔动画绘制（用于 AI 绘画回放） */
  loadStrokes: (strokes: ExternalStroke[], options?: { animate?: boolean; speed?: number }) => void;
}

/** 默认工具状态 */
export const DEFAULT_TOOL_STATE: ToolState = {
  activeTool: 'pen',
  activeColor: '#000000',
  activeBrushWidth: 4,
};
