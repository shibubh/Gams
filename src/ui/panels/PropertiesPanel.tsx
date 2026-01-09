/**
 * Properties Panel - Edit selected node properties
 * Fill, stroke, opacity, border radius, corners
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../state/store';
import { findNode, updateNode } from '../../engine/scene/sceneGraph';
import type { SceneNode, NodeStyle, RectangleNode } from '../../types/core';
import './PropertiesPanel.css';

export const PropertiesPanel: React.FC = () => {
  const scene = useAppStore((state) => state.scene);
  const selectedNodes = useAppStore((state) => state.selectedNodes);
  const updateScene = useAppStore((state) => state.updateScene);

  const [fillColor, setFillColor] = useState('#ffffff');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const [cornerRadius, setCornerRadius] = useState(0);

  // Get selected node
  const selectedNode = React.useMemo(() => {
    if (selectedNodes.size !== 1 || !scene) return null;
    const selectedId = Array.from(selectedNodes)[0];
    return findNode(scene, selectedId);
  }, [selectedNodes, scene]);

  // Update local state when selection changes
  useEffect(() => {
    if (selectedNode) {
      setFillColor(selectedNode.style?.fill?.color || '#ffffff');
      setStrokeColor(selectedNode.style?.stroke?.color || '#000000');
      setStrokeWidth(selectedNode.style?.stroke?.width || 1);
      setOpacity(selectedNode.style?.opacity || 1);
      
      // Get corner radius if it's a rectangle
      if (selectedNode.type === 'RECTANGLE') {
        const rectNode = selectedNode as RectangleNode;
        setCornerRadius(rectNode.cornerRadius || 0);
      } else {
        setCornerRadius(0);
      }
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="properties-panel">
        <div className="properties-empty">
          Select an object to edit properties
        </div>
      </div>
    );
  }

  const handleFillColorChange = (color: string) => {
    setFillColor(color);
    updateNodeStyle({
      fill: {
        type: 'solid',
        color,
        opacity: selectedNode.style?.fill?.opacity || 1,
      },
    });
  };

  const handleStrokeColorChange = (color: string) => {
    setStrokeColor(color);
    updateNodeStyle({
      stroke: {
        ...selectedNode.style?.stroke,
        color,
        width: strokeWidth,
        opacity: selectedNode.style?.stroke?.opacity || 1,
      },
    });
  };

  const handleStrokeWidthChange = (width: number) => {
    setStrokeWidth(width);
    updateNodeStyle({
      stroke: {
        color: strokeColor,
        width,
        opacity: selectedNode.style?.stroke?.opacity || 1,
      },
    });
  };

  const handleOpacityChange = (newOpacity: number) => {
    setOpacity(newOpacity);
    updateNodeStyle({
      opacity: newOpacity,
    });
  };

  const handleCornerRadiusChange = (radius: number) => {
    setCornerRadius(radius);
    if (selectedNode.type === 'RECTANGLE' && scene) {
      const updatedScene = updateNode(scene, selectedNode.id, {
        cornerRadius: radius,
      });
      updateScene(updatedScene);
    }
  };

  const updateNodeStyle = (styleUpdates: Partial<NodeStyle>) => {
    if (!scene) return;

    const updatedStyle = {
      ...selectedNode.style,
      ...styleUpdates,
    };

    const updatedScene = updateNode(scene, selectedNode.id, {
      style: updatedStyle,
    });

    updateScene(updatedScene);
  };

  const isRectangle = selectedNode.type === 'RECTANGLE' || selectedNode.type === 'FRAME';

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <h3>Properties</h3>
        <div className="properties-node-type">{selectedNode.type}</div>
      </div>

      <div className="properties-section">
        <label className="properties-label">Fill</label>
        <div className="properties-color-input">
          <input
            type="color"
            value={fillColor}
            onChange={(e) => handleFillColorChange(e.target.value)}
            className="color-picker"
          />
          <input
            type="text"
            value={fillColor}
            onChange={(e) => handleFillColorChange(e.target.value)}
            className="color-text"
            placeholder="#ffffff"
          />
        </div>
      </div>

      <div className="properties-section">
        <label className="properties-label">Stroke</label>
        <div className="properties-color-input">
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => handleStrokeColorChange(e.target.value)}
            className="color-picker"
          />
          <input
            type="text"
            value={strokeColor}
            onChange={(e) => handleStrokeColorChange(e.target.value)}
            className="color-text"
            placeholder="#000000"
          />
        </div>
        <div className="properties-slider">
          <label className="properties-sublabel">Width</label>
          <input
            type="range"
            min="0"
            max="20"
            step="0.5"
            value={strokeWidth}
            onChange={(e) => handleStrokeWidthChange(parseFloat(e.target.value))}
            className="slider"
          />
          <input
            type="number"
            min="0"
            max="20"
            step="0.5"
            value={strokeWidth}
            onChange={(e) => handleStrokeWidthChange(parseFloat(e.target.value))}
            className="number-input"
          />
        </div>
      </div>

      <div className="properties-section">
        <label className="properties-label">Opacity</label>
        <div className="properties-slider">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
            className="slider"
          />
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
            className="number-input"
          />
        </div>
      </div>

      {isRectangle && (
        <div className="properties-section">
          <label className="properties-label">Corner Radius</label>
          <div className="properties-slider">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={cornerRadius}
              onChange={(e) => handleCornerRadiusChange(parseFloat(e.target.value))}
              className="slider"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={cornerRadius}
              onChange={(e) => handleCornerRadiusChange(parseFloat(e.target.value))}
              className="number-input"
            />
          </div>
        </div>
      )}

      <div className="properties-info">
        <div className="info-row">
          <span className="info-label">Position:</span>
          <span className="info-value">
            {Math.round(selectedNode.bounds.x)}, {Math.round(selectedNode.bounds.y)}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Size:</span>
          <span className="info-value">
            {Math.round(selectedNode.bounds.width)} × {Math.round(selectedNode.bounds.height)}
          </span>
        </div>
      </div>
    </div>
  );
};
