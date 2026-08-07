import type { Point, CanvasStroke } from '@draw-guess/shared';
import type { ToolState } from './Canvas.types';

/**
 * 对点数组进行中点平滑插值，使用 quadraticCurveTo 绘制平滑曲线
 */
export function smoothPath(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length < 2) {
    if (points.length === 1) {
      ctx.fillRect(points[0].x, points[0].y, 1, 1);
    }
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }

  // 连接到最后一个点
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
}

/**
 * 渲染单条笔画
 */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: CanvasStroke): void {
  ctx.save();

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = stroke.brush.width * 3; // 橡皮擦比画笔宽
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = stroke.brush.width;
    ctx.strokeStyle = stroke.brush.color;
    ctx.globalAlpha = stroke.brush.opacity;
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  smoothPath(ctx, stroke.points);

  ctx.restore();
}

/**
 * 全量重绘画布
 */
export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  strokes: CanvasStroke[],
  width: number,
  height: number
): void {
  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 绘制白色背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 按顺序重绘所有笔画
  for (const stroke of strokes) {
    drawStroke(ctx, stroke);
  }
}

/**
 * 获取相对于画布的坐标
 */
export function getCanvasCoords(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

/**
 * 设置画笔样式
 */
export function setBrushStyle(ctx: CanvasRenderingContext2D, toolState: ToolState): void {
  if (toolState.activeTool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = toolState.activeBrushWidth * 3;
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = toolState.activeBrushWidth;
    ctx.strokeStyle = toolState.activeColor;
    ctx.globalAlpha = 1;
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}
