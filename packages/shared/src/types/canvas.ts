/** 画笔配置 */
export interface BrushConfig {
  color: string;
  width: number;
  opacity: number;
}

/** 画布坐标点 */
export interface Point {
  x: number;
  y: number;
}

/** 画布笔触 */
export interface CanvasStroke {
  id: string;
  points: Point[];
  brush: BrushConfig;
  tool: 'pen' | 'eraser';
  timestamp: number;
}

/** 画布状态 */
export interface CanvasState {
  strokes: CanvasStroke[];
  undoneStrokes: CanvasStroke[];
  backgroundColor: string;
  width: number;
  height: number;
}

/** 画布尺寸 */
export interface CanvasSize {
  width: number;
  height: number;
}

/** 默认颜色调色板 */
export const DEFAULT_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#FF6B00',
  '#FFD600', '#00C853', '#00B0FF', '#2979FF',
  '#651FFF', '#D500F9',
] as const;

/** 默认画笔配置 */
export const DEFAULT_BRUSH: BrushConfig = {
  color: '#000000',
  width: 4,
  opacity: 1,
};
