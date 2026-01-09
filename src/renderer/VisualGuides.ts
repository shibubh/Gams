/**
 * Visual Guides - Distance measurements and spacing visualization
 * Shows distances between selected objects and nearby objects
 */

import type { SceneNode, Bounds, NodeId } from '../../types/core';
import type { NodeStyleExtended } from '../../types/styles';

export interface DistanceGuide {
  from: Bounds;
  to: Bounds;
  direction: 'horizontal' | 'vertical';
  distance: number;
  label: string;
}

export interface MarginPaddingVisualization {
  nodeId: NodeId;
  bounds: Bounds;
  margin?: { t: number; r: number; b: number; l: number };
  padding?: { t: number; r: number; b: number; l: number };
}

/**
 * Calculate distance guides between selected node and other visible nodes
 */
export function calculateDistanceGuides(
  selectedNode: SceneNode,
  allVisibleNodes: SceneNode[],
  maxDistance: number = 500
): DistanceGuide[] {
  const guides: DistanceGuide[] = [];
  const selectedBounds = selectedNode.bounds;

  allVisibleNodes.forEach((node) => {
    if (node.id === selectedNode.id) return;

    const nodeBounds = node.bounds;

    // Check horizontal distances
    // Right side of selected to left side of other
    if (nodeBounds.x > selectedBounds.x + selectedBounds.width) {
      const distance = nodeBounds.x - (selectedBounds.x + selectedBounds.width);
      if (distance <= maxDistance) {
        guides.push({
          from: selectedBounds,
          to: nodeBounds,
          direction: 'horizontal',
          distance,
          label: `${Math.round(distance)}px`,
        });
      }
    }
    // Left side of selected to right side of other
    else if (nodeBounds.x + nodeBounds.width < selectedBounds.x) {
      const distance = selectedBounds.x - (nodeBounds.x + nodeBounds.width);
      if (distance <= maxDistance) {
        guides.push({
          from: selectedBounds,
          to: nodeBounds,
          direction: 'horizontal',
          distance,
          label: `${Math.round(distance)}px`,
        });
      }
    }

    // Check vertical distances
    // Bottom of selected to top of other
    if (nodeBounds.y > selectedBounds.y + selectedBounds.height) {
      const distance = nodeBounds.y - (selectedBounds.y + selectedBounds.height);
      if (distance <= maxDistance) {
        guides.push({
          from: selectedBounds,
          to: nodeBounds,
          direction: 'vertical',
          distance,
          label: `${Math.round(distance)}px`,
        });
      }
    }
    // Top of selected to bottom of other
    else if (nodeBounds.y + nodeBounds.height < selectedBounds.y) {
      const distance = selectedBounds.y - (nodeBounds.y + nodeBounds.height);
      if (distance <= maxDistance) {
        guides.push({
          from: selectedBounds,
          to: nodeBounds,
          direction: 'vertical',
          distance,
          label: `${Math.round(distance)}px`,
        });
      }
    }
  });

  return guides;
}

/**
 * Extract margin/padding visualization data from node style
 */
export function getMarginPaddingVisualization(
  node: SceneNode,
  style?: NodeStyleExtended
): MarginPaddingVisualization | null {
  if (!style?.boxModel) return null;

  const { margin, padding } = style.boxModel;

  // Only return if there's actual margin or padding
  const hasMargin = margin && (margin.t > 0 || margin.r > 0 || margin.b > 0 || margin.l > 0);
  const hasPadding = padding && (padding.t > 0 || padding.r > 0 || padding.b > 0 || padding.l > 0);

  if (!hasMargin && !hasPadding) return null;

  return {
    nodeId: node.id,
    bounds: node.bounds,
    margin: hasMargin ? margin : undefined,
    padding: hasPadding ? padding : undefined,
  };
}
