/**
 * Toolbar component - tool selection UI.
 */

import React from 'react';
import { useAppStore } from '../../state/store';
import type { ToolType } from '../../types/core';
import './Toolbar.css';

const tools: { type: ToolType; icon: string; label: string }[] = [
  { type: 'SELECT' as ToolType, icon: '⌖', label: 'Select (V)' },
  { type: 'PAN' as ToolType, icon: '✋', label: 'Pan (H)' },
  { type: 'RECTANGLE' as ToolType, icon: '▭', label: 'Rectangle (R)' },
  { type: 'ELLIPSE' as ToolType, icon: '○', label: 'Ellipse (O)' },
  { type: 'LINE' as ToolType, icon: '╱', label: 'Line (L)' },
  { type: 'TEXT' as ToolType, icon: 'T', label: 'Text (T)' },
];

export const Toolbar: React.FC = () => {
  const currentTool = useAppStore((state) => state.currentTool);
  const setTool = useAppStore((state) => state.setTool);

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        {tools.map((tool) => (
          <button
            key={tool.type}
            className={`toolbar-button ${currentTool === tool.type ? 'active' : ''}`}
            onClick={() => setTool(tool.type)}
            title={tool.label}
          >
            <span className="toolbar-icon">{tool.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
