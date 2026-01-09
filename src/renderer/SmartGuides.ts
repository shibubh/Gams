/**
 * Smart Guides (Figma-style)
 * Shows alignment and spacing guides during interactions
 */

import type { SceneNode, Bounds, Point } from '../types/core';

export interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  position: number; // x for vertical, y for horizontal
  alignmentType: 'edge-left' | 'edge-right' | 'edge-top' | 'edge-bottom' | 'center-x' | 'center-y';
  nodes: string[]; // IDs of nodes that align
}

export interface SpacingGuide {
  type: 'horizontal' | 'vertical';
  from: Bounds;
  to: Bounds;
  spacing: number;
  label: string;
}

export interface DistanceMeasurement {
  from: Point;
  to: Point;
  direction: 'horizontal' | 'vertical';
  distance: number;
  label: string;
}

/**
 * Calculate alignment guides (Figma-style)
 * Shows when edges or centers of objects align
 */
export function calculateAlignmentGuides(
  movingNode: SceneNode,
  allNodes: SceneNode[],
  threshold: number = 2 // pixels
): AlignmentGuide[] {
  const guides: AlignmentGuide[] = [];
  const bounds = movingNode.bounds;

  // Calculate key positions for the moving node
  const left = bounds.x;
  const right = bounds.x + bounds.width;
  const centerX = bounds.x + bounds.width / 2;
  const top = bounds.y;
  const bottom = bounds.y + bounds.height;
  const centerY = bounds.y + bounds.height / 2;

  const verticalAlignments: Map<number, { type: AlignmentGuide['alignmentType']; nodes: string[] }> = new Map();
  const horizontalAlignments: Map<number, { type: AlignmentGuide['alignmentType']; nodes: string[] }> = new Map();

  allNodes.forEach((node) => {
    if (node.id === movingNode.id) return;

    const nb = node.bounds;
    const nLeft = nb.x;
    const nRight = nb.x + nb.width;
    const nCenterX = nb.x + nb.width / 2;
    const nTop = nb.y;
    const nBottom = nb.y + nb.height;
    const nCenterY = nb.y + nb.height / 2;

    // Check vertical alignments (x-axis)
    if (Math.abs(left - nLeft) < threshold) {
      addAlignment(verticalAlignments, left, 'edge-left', node.id);
    }
    if (Math.abs(right - nRight) < threshold) {
      addAlignment(verticalAlignments, right, 'edge-right', node.id);
    }
    if (Math.abs(centerX - nCenterX) < threshold) {
      addAlignment(verticalAlignments, centerX, 'center-x', node.id);
    }
    if (Math.abs(left - nRight) < threshold) {
      addAlignment(verticalAlignments, left, 'edge-left', node.id);
    }
    if (Math.abs(right - nLeft) < threshold) {
      addAlignment(verticalAlignments, right, 'edge-right', node.id);
    }

    // Check horizontal alignments (y-axis)
    if (Math.abs(top - nTop) < threshold) {
      addAlignment(horizontalAlignments, top, 'edge-top', node.id);
    }
    if (Math.abs(bottom - nBottom) < threshold) {
      addAlignment(horizontalAlignments, bottom, 'edge-bottom', node.id);
    }
    if (Math.abs(centerY - nCenterY) < threshold) {
      addAlignment(horizontalAlignments, centerY, 'center-y', node.id);
    }
    if (Math.abs(top - nBottom) < threshold) {
      addAlignment(horizontalAlignments, top, 'edge-top', node.id);
    }
    if (Math.abs(bottom - nTop) < threshold) {
      addAlignment(horizontalAlignments, bottom, 'edge-bottom', node.id);
    }
  });

  // Convert to guides
  verticalAlignments.forEach((value, position) => {
    guides.push({
      type: 'vertical',
      position,
      alignmentType: value.type,
      nodes: value.nodes,
    });
  });

  horizontalAlignments.forEach((value, position) => {
    guides.push({
      type: 'horizontal',
      position,
      alignmentType: value.type,
      nodes: value.nodes,
    });
  });

  return guides;
}

function addAlignment(
  map: Map<number, { type: any; nodes: string[] }>,
  position: number,
  type: any,
  nodeId: string
) {
  const existing = map.get(position);
  if (existing) {
    existing.nodes.push(nodeId);
  } else {
    map.set(position, { type, nodes: [nodeId] });
  }
}

/**
 * Calculate spacing guides (Figma-style)
 * Shows when spacing between objects is equal
 */
export function calculateSpacingGuides(
  movingNode: SceneNode,
  allNodes: SceneNode[]
): SpacingGuide[] {
  const guides: SpacingGuide[] = [];
  const bounds = movingNode.bounds;

  // Find potential spacing matches
  const horizontalSpacings: Map<number, { from: Bounds; to: Bounds }[]> = new Map();
  const verticalSpacings: Map<number, { from: Bounds; to: Bounds }[]> = new Map();

  // Calculate spacings between all pairs of nodes
  for (let i = 0; i < allNodes.length; i++) {
    for (let j = i + 1; j < allNodes.length; j++) {
      const node1 = allNodes[i];
      const node2 = allNodes[j];

      if (node1.id === movingNode.id || node2.id === movingNode.id) continue;

      const b1 = node1.bounds;
      const b2 = node2.bounds;

      // Horizontal spacing (left-right)
      if (b2.x > b1.x + b1.width) {
        const spacing = b2.x - (b1.x + b1.width);
        const pairs = horizontalSpacings.get(spacing) || [];
        pairs.push({ from: b1, to: b2 });
        horizontalSpacings.set(spacing, pairs);
      }

      // Vertical spacing (top-bottom)
      if (b2.y > b1.y + b1.height) {
        const spacing = b2.y - (b1.y + b1.height);
        const pairs = verticalSpacings.get(spacing) || [];
        pairs.push({ from: b1, to: b2 });
        verticalSpacings.set(spacing, pairs);
      }
    }
  }

  // Check if moving node creates equal spacing
  allNodes.forEach((node) => {
    if (node.id === movingNode.id) return;

    const nb = node.bounds;

    // Horizontal spacing
    if (nb.x > bounds.x + bounds.width) {
      const spacing = nb.x - (bounds.x + bounds.width);
      const matches = horizontalSpacings.get(spacing);
      if (matches && matches.length > 0) {
        guides.push({
          type: 'horizontal',
          from: bounds,
          to: nb,
          spacing,
          label: `${Math.round(spacing)}`,
        });
      }
    } else if (bounds.x > nb.x + nb.width) {
      const spacing = bounds.x - (nb.x + nb.width);
      const matches = horizontalSpacings.get(spacing);
      if (matches && matches.length > 0) {
        guides.push({
          type: 'horizontal',
          from: nb,
          to: bounds,
          spacing,
          label: `${Math.round(spacing)}`,
        });
      }
    }

    // Vertical spacing
    if (nb.y > bounds.y + bounds.height) {
      const spacing = nb.y - (bounds.y + bounds.height);
      const matches = verticalSpacings.get(spacing);
      if (matches && matches.length > 0) {
        guides.push({
          type: 'vertical',
          from: bounds,
          to: nb,
          spacing,
          label: `${Math.round(spacing)}`,
        });
      }
    } else if (bounds.y > nb.y + nb.height) {
      const spacing = bounds.y - (nb.y + nb.height);
      const matches = verticalSpacings.get(spacing);
      if (matches && matches.length > 0) {
        guides.push({
          type: 'vertical',
          from: nb,
          to: bounds,
          spacing,
          label: `${Math.round(spacing)}`,
        });
      }
    }
  });

  return guides;
}

/**
 * Calculate distance measurements during drag or selection
 * Shows distance from object to nearest siblings or parent bounds
 * @param movingNode - The selected/moving node
 * @param allNodes - All visible nodes (siblings)
 * @param parentBounds - Optional parent container bounds (for distance to parent edges)
 */
export function calculateDistanceMeasurements(
  movingNode: SceneNode,
  allNodes: SceneNode[],
  parentBounds?: Bounds
): DistanceMeasurement[] {
  const measurements: DistanceMeasurement[] = [];
  const bounds = movingNode.bounds;

  let nearestLeft: { node: SceneNode; distance: number } | null = null;
  let nearestRight: { node: SceneNode; distance: number } | null = null;
  let nearestTop: { node: SceneNode; distance: number } | null = null;
  let nearestBottom: { node: SceneNode; distance: number } | null = null;

  // Find nearest sibling objects on each side
  allNodes.forEach((node) => {
    if (node.id === movingNode.id) return;
    // Skip parent/container nodes (frames that contain the selected node)
    if (node.bounds.x <= bounds.x &&
        node.bounds.y <= bounds.y &&
        node.bounds.x + node.bounds.width >= bounds.x + bounds.width &&
        node.bounds.y + node.bounds.height >= bounds.y + bounds.height) {
      return;
    }

    const nb = node.bounds;

    // Check left - object is to the left of selected
    if (nb.x + nb.width <= bounds.x) {
      const distance = bounds.x - (nb.x + nb.width);
      if (!nearestLeft || distance < nearestLeft.distance) {
        nearestLeft = { node, distance };
      }
    }

    // Check right - object is to the right of selected
    if (nb.x >= bounds.x + bounds.width) {
      const distance = nb.x - (bounds.x + bounds.width);
      if (!nearestRight || distance < nearestRight.distance) {
        nearestRight = { node, distance };
      }
    }

    // Check top - object is above selected
    if (nb.y + nb.height <= bounds.y) {
      const distance = bounds.y - (nb.y + nb.height);
      if (!nearestTop || distance < nearestTop.distance) {
        nearestTop = { node, distance };
      }
    }

    // Check bottom - object is below selected
    if (nb.y >= bounds.y + bounds.height) {
      const distance = nb.y - (bounds.y + bounds.height);
      if (!nearestBottom || distance < nearestBottom.distance) {
        nearestBottom = { node, distance };
      }
    }
  });

  // Add measurements for nearest objects or parent bounds
  const centerY = bounds.y + bounds.height / 2;
  const centerX = bounds.x + bounds.width / 2;

  // Note: Type assertions below are required due to TypeScript limitation with control flow analysis
  // When variables are reassigned in forEach callbacks, TypeScript fails to narrow types correctly
  // even after null checks. See: https://github.com/microsoft/TypeScript/issues/9998

  // Left side - show distance to nearest sibling or parent
  if (nearestLeft !== null) {
    const leftMeasure = nearestLeft as { node: SceneNode; distance: number };
    measurements.push({
      from: { x: bounds.x, y: centerY },
      to: { x: leftMeasure.node.bounds.x + leftMeasure.node.bounds.width, y: centerY },
      direction: 'horizontal',
      distance: leftMeasure.distance,
      label: `${Math.round(leftMeasure.distance)}`,
    });
  } else if (parentBounds) {
    const distToParentLeft = bounds.x - parentBounds.x;
    if (distToParentLeft > 0) {
      measurements.push({
        from: { x: bounds.x, y: centerY },
        to: { x: parentBounds.x, y: centerY },
        direction: 'horizontal',
        distance: distToParentLeft,
        label: `${Math.round(distToParentLeft)}`,
      });
    }
  }

  // Right side - show distance to nearest sibling or parent
  if (nearestRight !== null) {
    const rightMeasure = nearestRight as { node: SceneNode; distance: number };
    measurements.push({
      from: { x: bounds.x + bounds.width, y: centerY },
      to: { x: rightMeasure.node.bounds.x, y: centerY },
      direction: 'horizontal',
      distance: rightMeasure.distance,
      label: `${Math.round(rightMeasure.distance)}`,
    });
  } else if (parentBounds) {
    const distToParentRight = (parentBounds.x + parentBounds.width) - (bounds.x + bounds.width);
    if (distToParentRight > 0) {
      measurements.push({
        from: { x: bounds.x + bounds.width, y: centerY },
        to: { x: parentBounds.x + parentBounds.width, y: centerY },
        direction: 'horizontal',
        distance: distToParentRight,
        label: `${Math.round(distToParentRight)}`,
      });
    }
  }

  // Top side - show distance to nearest sibling or parent
  if (nearestTop !== null) {
    const topMeasure = nearestTop as { node: SceneNode; distance: number };
    measurements.push({
      from: { x: centerX, y: bounds.y },
      to: { x: centerX, y: topMeasure.node.bounds.y + topMeasure.node.bounds.height },
      direction: 'vertical',
      distance: topMeasure.distance,
      label: `${Math.round(topMeasure.distance)}`,
    });
  } else if (parentBounds) {
    const distToParentTop = bounds.y - parentBounds.y;
    if (distToParentTop > 0) {
      measurements.push({
        from: { x: centerX, y: bounds.y },
        to: { x: centerX, y: parentBounds.y },
        direction: 'vertical',
        distance: distToParentTop,
        label: `${Math.round(distToParentTop)}`,
      });
    }
  }

  // Bottom side - show distance to nearest sibling or parent
  if (nearestBottom !== null) {
    const bottomMeasure = nearestBottom as { node: SceneNode; distance: number };
    measurements.push({
      from: { x: centerX, y: bounds.y + bounds.height },
      to: { x: centerX, y: bottomMeasure.node.bounds.y },
      direction: 'vertical',
      distance: bottomMeasure.distance,
      label: `${Math.round(bottomMeasure.distance)}`,
    });
  } else if (parentBounds) {
    const distToParentBottom = (parentBounds.y + parentBounds.height) - (bounds.y + bounds.height);
    if (distToParentBottom > 0) {
      measurements.push({
        from: { x: centerX, y: bounds.y + bounds.height },
        to: { x: centerX, y: parentBounds.y + parentBounds.height },
        direction: 'vertical',
        distance: distToParentBottom,
        label: `${Math.round(distToParentBottom)}`,
      });
    }
  }

  return measurements;
}
