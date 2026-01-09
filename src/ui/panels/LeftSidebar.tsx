/**
 * Left Sidebar - Layers panel
 */

import React from 'react';
import { useAppStore } from '../../state/store';
import './LeftSidebar.css';

export const LeftSidebar: React.FC = () => {
  const scene = useAppStore((state) => state.scene);
  const selectedNodes = useAppStore((state) => state.selectedNodes);
  const setSelection = useAppStore((state) => state.setSelection);

  const renderNode = (node: any, depth = 0): React.ReactNode => {
    if (!node || !node.style?.visible) return null;

    const isSelected = selectedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} style={{ marginLeft: `${depth * 12}px` }}>
        <div
          className={`layer-item ${isSelected ? 'selected' : ''}`}
          onClick={() => setSelection([node.id])}
        >
          <span className="layer-type">{node.type}</span>
          <span className="layer-name">{node.name}</span>
        </div>
        {hasChildren && (
          <div className="layer-children">
            {node.children.map((child: any) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="left-sidebar">
      <div className="sidebar-header">
        <h3>Layers</h3>
      </div>
      <div className="layers-list">
        {scene?.children?.map((child) => renderNode(child, 0))}
      </div>
    </div>
  );
};
