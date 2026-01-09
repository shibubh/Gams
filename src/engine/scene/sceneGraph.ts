/**
 * Scene Graph - Immutable AST-based scene model.
 * All scene updates produce new immutable nodes.
 */

import { nanoid } from 'nanoid';
import { mat3, vec2 } from 'gl-matrix';
import type {
  SceneNode,
  NodeId,
  Transform,
  Bounds,
  NodeStyle,
  FrameNode,
  RectangleNode,
  EllipseNode,
  LineNode,
  TextNode,
  GroupNode,
  Point,
  TextStyle,
} from '../../types/core';
import { NodeType } from '../../types/core';

/**
 * Create a default transform at origin.
 */
export function createTransform(): Transform {
  return {
    matrix: mat3.create(),
    position: vec2.fromValues(0, 0),
    rotation: 0,
    scale: vec2.fromValues(1, 1),
  };
}

/**
 * Update transform matrix from components.
 */
export function updateTransformMatrix(transform: Transform): Transform {
  const matrix = mat3.create();
  
  // Apply transformations: translate -> rotate -> scale
  mat3.translate(matrix, matrix, transform.position);
  mat3.rotate(matrix, matrix, transform.rotation);
  mat3.scale(matrix, matrix, transform.scale);

  return { ...transform, matrix };
}

/**
 * Create default node style.
 */
function createDefaultStyle(): NodeStyle {
  return {
    fill: { type: 'solid', color: '#ffffff', opacity: 1 },
    stroke: { color: '#000000', width: 1, opacity: 1 },
    opacity: 1,
    visible: true,
    locked: false,
  };
}

/**
 * Base node creation helper.
 */
function createBaseNode(
  _type: NodeType,
  name: string,
  bounds: Bounds,
  style?: Partial<NodeStyle>
): Omit<FrameNode | RectangleNode | EllipseNode | LineNode | TextNode | GroupNode, 'type'> {
  return {
    id: nanoid(),
    name,
    transform: createTransform(),
    bounds,
    style: { ...createDefaultStyle(), ...style },
    children: [],
    zIndex: 0,
  } as any;
}

/**
 * Calculate bounds for a node and its children.
 */
export function calculateBounds(node: SceneNode): Bounds {
  if (!node.children || node.children.length === 0) {
    return node.bounds;
  }

  // For groups/frames, compute bounding box of all children
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const processNode = (n: SceneNode) => {
    const b = n.bounds;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);

    if (n.children) {
      n.children.forEach(processNode);
    }
  };

  node.children.forEach(processNode);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ============================================================================
// Node Factory Functions
// ============================================================================

export function createFrame(
  name: string,
  bounds: Bounds,
  style?: Partial<NodeStyle>
): FrameNode {
  return {
    ...createBaseNode(NodeType.Frame, name, bounds, style),
    type: NodeType.Frame,
    clipsContent: true,
    backgroundColor: '#ffffff',
  } as FrameNode;
}

export function createRectangle(
  name: string,
  bounds: Bounds,
  style?: Partial<NodeStyle>
): RectangleNode {
  // Default style with 20px margin and 10px padding
  const defaultStyleWithBoxModel = {
    ...style,
    boxModel: {
      margin: { t: 20, r: 20, b: 20, l: 20 },
      padding: { t: 10, r: 10, b: 10, l: 10 },
      border: {
        width: { t: 0, r: 0, b: 0, l: 0 },
        color: '#000000',
        style: 'solid' as const,
      },
      radius: { tl: 0, tr: 0, br: 0, bl: 0 },
    },
  };

  return {
    ...createBaseNode(NodeType.Rectangle, name, bounds, defaultStyleWithBoxModel),
    type: NodeType.Rectangle,
    cornerRadius: 0,
  } as RectangleNode;
}

export function createEllipse(
  name: string,
  bounds: Bounds,
  style?: Partial<NodeStyle>
): EllipseNode {
  return {
    ...createBaseNode(NodeType.Ellipse, name, bounds, style),
    type: NodeType.Ellipse,
  } as EllipseNode;
}

export function createLine(
  name: string,
  startPoint: Point,
  endPoint: Point,
  style?: Partial<NodeStyle>
): LineNode {
  const bounds: Bounds = {
    x: Math.min(startPoint.x, endPoint.x),
    y: Math.min(startPoint.y, endPoint.y),
    width: Math.abs(endPoint.x - startPoint.x),
    height: Math.abs(endPoint.y - startPoint.y),
  };

  return {
    ...createBaseNode(NodeType.Line, name, bounds, style),
    type: NodeType.Line,
    startPoint,
    endPoint,
  } as LineNode;
}

export function createText(
  name: string,
  content: string,
  position: Point,
  textStyle?: Partial<TextStyle>,
  style?: Partial<NodeStyle>
): TextNode {
  const defaultTextStyle: TextStyle = {
    fontFamily: 'Arial, sans-serif',
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
    textAlign: 'left',
    color: '#000000',
    ...textStyle,
  };

  // Estimate bounds based on text (rough approximation)
  const width = content.length * defaultTextStyle.fontSize * 0.6;
  const height = defaultTextStyle.fontSize * defaultTextStyle.lineHeight;

  const bounds: Bounds = {
    x: position.x,
    y: position.y,
    width,
    height,
  };

  return {
    ...createBaseNode(NodeType.Text, name, bounds, style),
    type: NodeType.Text,
    content,
    textStyle: defaultTextStyle,
  } as TextNode;
}

export function createGroup(
  name: string,
  children: SceneNode[] = []
): GroupNode {
  const bounds = children.length > 0
    ? calculateBounds({ children } as any)
    : { x: 0, y: 0, width: 0, height: 0 };

  return {
    ...createBaseNode(NodeType.Group, name, bounds),
    type: NodeType.Group,
    children,
  } as GroupNode;
}

// ============================================================================
// Scene Graph Operations (Immutable)
// ============================================================================

/**
 * Update a node in the scene tree immutably.
 */
export function updateNode(
  root: SceneNode,
  nodeId: NodeId,
  updates: Partial<SceneNode>
): SceneNode {
  if (root.id === nodeId) {
    return { ...root, ...updates } as SceneNode;
  }

  if (root.children && root.children.length > 0) {
    const newChildren = root.children.map((child) =>
      updateNode(child, nodeId, updates)
    );
    return { ...root, children: newChildren };
  }

  return root;
}

/**
 * Find a node by ID in the scene tree.
 */
export function findNode(root: SceneNode, nodeId: NodeId): SceneNode | null {
  if (root.id === nodeId) {
    return root;
  }

  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child, nodeId);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Find the parent node (Frame) that contains this node.
 * Returns null if the node has no parent frame.
 * 
 * @param root - The scene root to search from
 * @param nodeId - The ID of the node whose parent frame to find
 * @returns The parent FrameNode if found, null otherwise
 */
export function findParentFrame(root: SceneNode, nodeId: NodeId): SceneNode | null {
  // Helper function to search recursively
  const searchParent = (node: SceneNode, targetId: NodeId): SceneNode | null => {
    if (node.children) {
      for (const child of node.children) {
        if (child.id === targetId) {
          // Found the target as a direct child - return current node as parent
          // Only return if it's a FRAME type
          if (node.type === NodeType.Frame) {
            return node;
          }
          return null;
        }
        // Recursively search in children
        const found = searchParent(child, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  return searchParent(root, nodeId);
}

/**
 * Add a child node to a parent.
 */
export function addChild(
  root: SceneNode,
  parentId: NodeId,
  child: SceneNode
): SceneNode {
  if (root.id === parentId) {
    return {
      ...root,
      children: [...(root.children || []), { ...child, parent: parentId }],
    };
  }

  if (root.children) {
    return {
      ...root,
      children: root.children.map((c) => addChild(c, parentId, child)),
    };
  }

  return root;
}

/**
 * Remove a node from the scene tree.
 */
export function removeNode(root: SceneNode, nodeId: NodeId): SceneNode {
  if (root.children) {
    const newChildren = root.children
      .filter((child) => child.id !== nodeId)
      .map((child) => removeNode(child, nodeId));
    return { ...root, children: newChildren };
  }

  return root;
}

/**
 * Collect all nodes in the scene tree.
 */
export function collectAllNodes(root: SceneNode): SceneNode[] {
  const nodes: SceneNode[] = [root];

  if (root.children) {
    root.children.forEach((child) => {
      nodes.push(...collectAllNodes(child));
    });
  }

  return nodes;
}

/**
 * Get nodes at a specific point in world space.
 */
export function getNodesAtPoint(
  root: SceneNode,
  point: Point
): SceneNode[] {
  const nodes: SceneNode[] = [];

  const checkNode = (node: SceneNode) => {
    const { x, y, width, height } = node.bounds;
    if (
      point.x >= x &&
      point.x <= x + width &&
      point.y >= y &&
      point.y <= y + height
    ) {
      nodes.push(node);
    }

    if (node.children) {
      node.children.forEach(checkNode);
    }
  };

  checkNode(root);
  return nodes;
}
