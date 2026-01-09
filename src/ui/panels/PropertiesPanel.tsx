/**
 * Properties Panel - Edit selected node properties
 * Fill, stroke, opacity, border radius, corners
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../state/store';
import { findNode, updateNode } from '../../engine/scene/sceneGraph';
import type { SceneNode, NodeStyle, RectangleNode } from '../../types/core';
import type { NodeStyleExtended } from '../../types/styles';
import { createDefaultBoxModel } from '../../types/styles';
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
  const [marginTop, setMarginTop] = useState(0);
  const [marginRight, setMarginRight] = useState(0);
  const [marginBottom, setMarginBottom] = useState(0);
  const [marginLeft, setMarginLeft] = useState(0);
  const [paddingTop, setPaddingTop] = useState(0);
  const [paddingRight, setPaddingRight] = useState(0);
  const [paddingBottom, setPaddingBottom] = useState(0);
  const [paddingLeft, setPaddingLeft] = useState(0);

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
      
      // Get margin and padding from extended style
      const extendedStyle = selectedNode.style as unknown as NodeStyleExtended;
      if (extendedStyle?.boxModel) {
        setMarginTop(extendedStyle.boxModel.margin.t);
        setMarginRight(extendedStyle.boxModel.margin.r);
        setMarginBottom(extendedStyle.boxModel.margin.b);
        setMarginLeft(extendedStyle.boxModel.margin.l);
        setPaddingTop(extendedStyle.boxModel.padding.t);
        setPaddingRight(extendedStyle.boxModel.padding.r);
        setPaddingBottom(extendedStyle.boxModel.padding.b);
        setPaddingLeft(extendedStyle.boxModel.padding.l);
      } else {
        setMarginTop(0);
        setMarginRight(0);
        setMarginBottom(0);
        setMarginLeft(0);
        setPaddingTop(0);
        setPaddingRight(0);
        setPaddingBottom(0);
        setPaddingLeft(0);
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

  const handleMarginChange = (side: 't' | 'r' | 'b' | 'l', value: number) => {
    // Update local state
    if (side === 't') setMarginTop(value);
    else if (side === 'r') setMarginRight(value);
    else if (side === 'b') setMarginBottom(value);
    else if (side === 'l') setMarginLeft(value);
    
    if (!scene) return;
    
    const extendedStyle = (selectedNode.style as unknown as NodeStyleExtended) || {};
    const boxModel = extendedStyle.boxModel || createDefaultBoxModel();
    
    const updatedBoxModel = {
      ...boxModel,
      margin: {
        t: side === 't' ? value : marginTop,
        r: side === 'r' ? value : marginRight,
        b: side === 'b' ? value : marginBottom,
        l: side === 'l' ? value : marginLeft,
      },
    };
    
    const updatedStyle = {
      ...selectedNode.style,
      boxModel: updatedBoxModel,
    } as unknown as NodeStyle;
    
    const updatedScene = updateNode(scene, selectedNode.id, { style: updatedStyle });
    updateScene(updatedScene);
  };

  const handlePaddingChange = (side: 't' | 'r' | 'b' | 'l', value: number) => {
    // Update local state
    if (side === 't') setPaddingTop(value);
    else if (side === 'r') setPaddingRight(value);
    else if (side === 'b') setPaddingBottom(value);
    else if (side === 'l') setPaddingLeft(value);
    
    if (!scene) return;
    
    const extendedStyle = (selectedNode.style as unknown as NodeStyleExtended) || {};
    const boxModel = extendedStyle.boxModel || createDefaultBoxModel();
    
    const updatedBoxModel = {
      ...boxModel,
      padding: {
        t: side === 't' ? value : paddingTop,
        r: side === 'r' ? value : paddingRight,
        b: side === 'b' ? value : paddingBottom,
        l: side === 'l' ? value : paddingLeft,
      },
    };
    
    const updatedStyle = {
      ...selectedNode.style,
      boxModel: updatedBoxModel,
    } as unknown as NodeStyle;
    
    const updatedScene = updateNode(scene, selectedNode.id, { style: updatedStyle });
    updateScene(updatedScene);
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

      <div className="properties-section">
        <label className="properties-label">Margin (Visual Guide)</label>
        <div className="properties-edges">
          <div className="edge-input">
            <label>Top</label>
            <input
              type="number"
              min="0"
              max="200"
              value={marginTop}
              onChange={(e) => handleMarginChange('t', parseFloat(e.target.value) || 0)}
              className="number-input-small"
            />
          </div>
          <div className="edge-input">
            <label>Right</label>
            <input
              type="number"
              min="0"
              max="200"
              value={marginRight}
              onChange={(e) => handleMarginChange('r', parseFloat(e.target.value) || 0)}
              className="number-input-small"
            />
          </div>
          <div className="edge-input">
            <label>Bottom</label>
            <input
              type="number"
              min="0"
              max="200"
              value={marginBottom}
              onChange={(e) => handleMarginChange('b', parseFloat(e.target.value) || 0)}
              className="number-input-small"
            />
          </div>
          <div className="edge-input">
            <label>Left</label>
            <input
              type="number"
              min="0"
              max="200"
              value={marginLeft}
              onChange={(e) => handleMarginChange('l', parseFloat(e.target.value) || 0)}
              className="number-input-small"
            />
          </div>
        </div>
      </div>

      <div className="properties-section">
        <label className="properties-label">Padding (Visual Guide)</label>
        <div className="properties-edges">
          <div className="edge-input">
            <label>Top</label>
            <input
              type="number"
              min="0"
              max="200"
              value={paddingTop}
              onChange={(e) => handlePaddingChange('t', parseFloat(e.target.value) || 0)}
              className="number-input-small"
            />
          </div>
          <div className="edge-input">
            <label>Right</label>
            <input
              type="number"
              min="0"
              max="200"
              value={paddingRight}
              onChange={(e) => handlePaddingChange('r', parseFloat(e.target.value) || 0)}
              className="number-input-small"
            />
          </div>
          <div className="edge-input">
            <label>Bottom</label>
            <input
              type="number"
              min="0"
              max="200"
              value={paddingBottom}
              onChange={(e) => handlePaddingChange('b', parseFloat(e.target.value) || 0)}
              className="number-input-small"
            />
          </div>
          <div className="edge-input">
            <label>Left</label>
            <input
              type="number"
              min="0"
              max="200"
              value={paddingLeft}
              onChange={(e) => handlePaddingChange('l', parseFloat(e.target.value) || 0)}
              className="number-input-small"
            />
          </div>
        </div>
      </div>

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
