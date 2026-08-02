import React from 'react';
import type { ToolState } from '@draw-guess/ui';
import { DEFAULT_COLORS, BRUSH_SIZES } from '@draw-guess/shared';

interface ToolbarProps {
  toolState: ToolState;
  onToolChange: (toolState: ToolState) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  disabled?: boolean;
}

const toolButtonBase: React.CSSProperties = {
  padding: '0.5rem 1rem',
  border: '2px solid #ddd',
  borderRadius: '8px',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 500,
  transition: 'all 0.15s ease',
};

export const Toolbar: React.FC<ToolbarProps> = ({
  toolState,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  disabled = false,
}) => {
  const updateTool = (partial: Partial<ToolState>) => {
    onToolChange({ ...toolState, ...partial });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', userSelect: 'none' }}>
      {/* 工具切换 */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          style={{
            ...toolButtonBase,
            borderColor: toolState.activeTool === 'pen' ? '#2196f3' : '#ddd',
            background: toolState.activeTool === 'pen' ? '#e3f2fd' : '#fff',
            opacity: disabled ? 0.5 : 1,
          }}
          onClick={() => updateTool({ activeTool: 'pen' })}
          disabled={disabled}
        >
          ✏️ 画笔
        </button>
        <button
          style={{
            ...toolButtonBase,
            borderColor: toolState.activeTool === 'eraser' ? '#2196f3' : '#ddd',
            background: toolState.activeTool === 'eraser' ? '#e3f2fd' : '#fff',
            opacity: disabled ? 0.5 : 1,
          }}
          onClick={() => updateTool({ activeTool: 'eraser' })}
          disabled={disabled}
        >
          🧹 橡皮
        </button>
      </div>

      {/* 颜色面板 */}
      <div>
        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.4rem' }}>颜色</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {DEFAULT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => updateTool({ activeColor: color, activeTool: 'pen' })}
              disabled={disabled}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: toolState.activeColor === color && toolState.activeTool === 'pen'
                  ? '3px solid #2196f3'
                  : '2px solid #ddd',
                background: color,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                outline: 'none',
                transition: 'transform 0.1s ease',
                transform: toolState.activeColor === color && toolState.activeTool === 'pen'
                  ? 'scale(1.15)'
                  : 'scale(1)',
              }}
              aria-label={`颜色 ${color}`}
            />
          ))}
        </div>
      </div>

      {/* 笔触粗细 */}
      <div>
        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.4rem' }}>笔触</div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {([
            { label: '细', size: BRUSH_SIZES.thin },
            { label: '中', size: BRUSH_SIZES.medium },
            { label: '粗', size: BRUSH_SIZES.thick },
          ]).map(({ label, size }) => (
            <button
              key={size}
              onClick={() => updateTool({ activeBrushWidth: size, activeTool: 'pen' })}
              disabled={disabled}
              style={{
                ...toolButtonBase,
                padding: '0.3rem 0.6rem',
                minWidth: '40px',
                borderColor: toolState.activeBrushWidth === size && toolState.activeTool === 'pen'
                  ? '#2196f3'
                  : '#ddd',
                background:
                  toolState.activeBrushWidth === size && toolState.activeTool === 'pen'
                    ? '#e3f2fd'
                    : '#fff',
                opacity: disabled ? 0.5 : 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <div
                style={{
                  width: `${Math.min(size * 3, 24)}px`,
                  height: `${Math.min(size * 3, 24)}px`,
                  borderRadius: '50%',
                  background: toolState.activeColor,
                }}
              />
              <span style={{ fontSize: '0.7rem' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.2rem' }}>操作</div>
        <button
          style={{ ...toolButtonBase, opacity: canUndo && !disabled ? 1 : 0.4 }}
          onClick={onUndo}
          disabled={!canUndo || disabled}
        >
          ↩️ 撤销 (Ctrl+Z)
        </button>
        <button
          style={{ ...toolButtonBase, opacity: canRedo && !disabled ? 1 : 0.4 }}
          onClick={onRedo}
          disabled={!canRedo || disabled}
        >
          ↪️ 重做 (Ctrl+Y)
        </button>
        <button
          style={{
            ...toolButtonBase,
            borderColor: '#f44336',
            color: '#f44336',
            opacity: disabled ? 0.4 : 1,
          }}
          onClick={onClear}
          disabled={disabled}
        >
          🗑️ 清空画布
        </button>
      </div>
    </div>
  );
};
