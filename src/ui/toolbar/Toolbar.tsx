/**
 * Toolbar component - tool selection UI with lucide-react icons.
 */

import React from 'react';
import { 
  MousePointer2, 
  Hand, 
  Square, 
  Circle, 
  Minus, 
  Type,
  Frame as FrameIcon
} from 'lucide-react';
import { useAppStore } from '../../state/store';
import type { ToolType } from '../../types/core';
import './Toolbar.css';

interface ToolConfig {
  type: ToolType;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}

const tools: ToolConfig[] = [
  { type: 'FRAME' as ToolType, icon: FrameIcon, label: 'Frame (F)' },
  { type: 'SELECT' as ToolType, icon: MousePointer2, label: 'Select (V)' },
  { type: 'PAN' as ToolType, icon: Hand, label: 'Pan (H)' },
  { type: 'RECTANGLE' as ToolType, icon: Square, label: 'Rectangle (R)' },
  { type: 'ELLIPSE' as ToolType, icon: Circle, label: 'Ellipse (O)' },
  { type: 'LINE' as ToolType, icon: Minus, label: 'Line (L)' },
  { type: 'TEXT' as ToolType, icon: Type, label: 'Text (T)' },
];

export const Toolbar: React.FC = () => {
  const currentTool = useAppStore((state) => state.currentTool);
  const setTool = useAppStore((state) => state.setTool);

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = currentTool === tool.type;
          
          return (
            <button
              key={tool.type}
              className={`toolbar-button ${isActive ? 'active' : ''}`}
              onClick={() => setTool(tool.type)}
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={isActive}
            >
              <Icon size={18} className="toolbar-icon" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
