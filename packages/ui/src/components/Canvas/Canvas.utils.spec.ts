import { describe, it, expect, vi } from 'vitest';
import { getCanvasCoords, setBrushStyle } from './Canvas.utils';
import type { ToolState } from './Canvas.types';

// Create a proper mock canvas context for jsdom (which doesn't implement getContext)
function createMockContext(): CanvasRenderingContext2D {
  const ctx: Record<string, unknown> = {
    globalCompositeOperation: 'source-over',
    lineWidth: 1,
    strokeStyle: '#000000',
    fillStyle: '#000000',
    globalAlpha: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    arc: vi.fn(),
    canvas: { width: 800, height: 600 },
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  canvas.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 10, top: 20, width: 400, height: 300,
    right: 410, bottom: 320, x: 10, y: 20,
  } as DOMRect);

  return canvas;
}

describe('getCanvasCoords', () => {
  it('should convert client coordinates to canvas coordinates', () => {
    const canvas = createMockCanvas(800, 600);
    const point = getCanvasCoords(canvas, 210, 170);

    expect(point.x).toBe(400);
    expect(point.y).toBe(300);
  });

  it('should handle top-left corner', () => {
    const canvas = createMockCanvas(800, 600);
    const point = getCanvasCoords(canvas, 10, 20);

    expect(point.x).toBe(0);
    expect(point.y).toBe(0);
  });

  it('should handle bottom-right corner', () => {
    const canvas = createMockCanvas(800, 600);
    const point = getCanvasCoords(canvas, 410, 320);

    expect(point.x).toBe(800);
    expect(point.y).toBe(600);
  });

  it('should handle different canvas resolutions', () => {
    const canvas = createMockCanvas(400, 200);
    const point = getCanvasCoords(canvas, 210, 170);

    expect(point.x).toBe(200);
    expect(point.y).toBeCloseTo(100, 0);
  });
});

describe('setBrushStyle', () => {
  it('should set pen tool styles correctly', () => {
    const ctx = createMockContext();
    const toolState: ToolState = {
      activeTool: 'pen',
      activeColor: '#ff0000',
      activeBrushWidth: 4,
    };

    setBrushStyle(ctx, toolState);

    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.lineWidth).toBe(4);
    expect(ctx.strokeStyle).toBe('#ff0000');
    expect(ctx.lineCap).toBe('round');
    expect(ctx.lineJoin).toBe('round');
  });

  it('should set eraser tool styles correctly', () => {
    const ctx = createMockContext();
    const toolState: ToolState = {
      activeTool: 'eraser',
      activeColor: '#000000',
      activeBrushWidth: 2,
    };

    setBrushStyle(ctx, toolState);

    expect(ctx.globalCompositeOperation).toBe('destination-out');
    expect(ctx.lineWidth).toBe(6); // 2 * 3
    expect(ctx.strokeStyle).toBe('rgba(0,0,0,1)');
  });

  it('should handle different brush widths', () => {
    const ctx = createMockContext();
    const toolState: ToolState = {
      activeTool: 'pen',
      activeColor: '#00ff00',
      activeBrushWidth: 8,
    };

    setBrushStyle(ctx, toolState);

    expect(ctx.lineWidth).toBe(8);
  });
});
