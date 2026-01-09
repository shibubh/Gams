/**
 * Status Bar - Bottom status information
 */

import React from 'react';
import { useAppStore } from '../../state/store';
import './StatusBar.css';

export const StatusBar: React.FC = () => {
  const selectedNodes = useAppStore((state) => state.selectedNodes);
  const currentTool = useAppStore((state) => state.currentTool);
  const scene = useAppStore((state) => state.scene);

  const frameCount = scene?.children?.filter(child => child.type === 'FRAME').length || 0;
  const totalObjects = scene?.children?.length || 0;

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-label">Tool:</span>
        <span className="status-value">{currentTool}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Frames:</span>
        <span className="status-value">{frameCount}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Objects:</span>
        <span className="status-value">{totalObjects}</span>
      </div>
      <div className="status-item">
        <span className="status-label">Selected:</span>
        <span className="status-value">{selectedNodes.size}</span>
      </div>
    </div>
  );
};
