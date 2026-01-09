/**
 * Right Sidebar - Properties panel
 * Shows when an object is selected
 */

import React from 'react';
import { useAppStore } from '../../state/store';
import { findNode } from '../../engine/scene/sceneGraph';
import './RightSidebar.css';

export const RightSidebar: React.FC = () => {
  const scene = useAppStore((state) => state.scene);
  const selectedNodes = useAppStore((state) => state.selectedNodes);

  const selectedNodeIds = Array.from(selectedNodes);
  const selectedNode = selectedNodeIds.length === 1 && scene
    ? findNode(scene, selectedNodeIds[0])
    : null;

  if (!selectedNode) {
    return null; // Hide when nothing is selected
  }

  return (
    <div className="right-sidebar">
      <div className="sidebar-header">
        <h3>Properties</h3>
      </div>
      <div className="properties-content">
        <div className="property-section">
          <h4>Node</h4>
          <div className="property-row">
            <label>Type:</label>
            <span>{selectedNode.type}</span>
          </div>
          <div className="property-row">
            <label>Name:</label>
            <span>{selectedNode.name}</span>
          </div>
        </div>

        <div className="property-section">
          <h4>Position & Size</h4>
          <div className="property-row">
            <label>X:</label>
            <span>{Math.round(selectedNode.bounds.x)}</span>
          </div>
          <div className="property-row">
            <label>Y:</label>
            <span>{Math.round(selectedNode.bounds.y)}</span>
          </div>
          <div className="property-row">
            <label>Width:</label>
            <span>{Math.round(selectedNode.bounds.width)}</span>
          </div>
          <div className="property-row">
            <label>Height:</label>
            <span>{Math.round(selectedNode.bounds.height)}</span>
          </div>
        </div>

        <div className="property-section">
          <h4>Style</h4>
          <div className="property-row">
            <label>Fill:</label>
            <div className="color-preview" style={{ backgroundColor: selectedNode.style.fill?.color || 'transparent' }} />
          </div>
          <div className="property-row">
            <label>Stroke:</label>
            <div className="color-preview" style={{ backgroundColor: selectedNode.style.stroke?.color || 'transparent' }} />
          </div>
          <div className="property-row">
            <label>Opacity:</label>
            <span>{Math.round((selectedNode.style.opacity || 1) * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
