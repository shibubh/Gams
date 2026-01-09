/**
 * Utilities for creating and manipulating scene nodes
 */

import { nanoid } from "nanoid";
import type { ID, SceneNode, Rect } from "./types";
import { mat3Identity, rect } from "./math";

/**
 * Generate a unique ID
 */
export function generateId(): ID {
  return nanoid();
}

/**
 * Create a rectangle node
 */
export function createRectNode(
  bounds: Rect,
  style?: Partial<SceneNode & { type: "rect" }>["style"]
): SceneNode {
  return {
    id: generateId(),
    type: "rect",
    parentId: null,
    childIds: [],
    localTransform: mat3Identity(),
    worldTransformVersion: 0,
    localBounds: bounds,
    worldBounds: bounds,
    style: {
      fill: "#3b82f6",
      stroke: "#1e40af",
      strokeWidth: 1,
      radius: 0,
      ...style,
    },
  };
}

/**
 * Create an ellipse node
 */
export function createEllipseNode(
  bounds: Rect,
  style?: Partial<SceneNode & { type: "ellipse" }>["style"]
): SceneNode {
  return {
    id: generateId(),
    type: "ellipse",
    parentId: null,
    childIds: [],
    localTransform: mat3Identity(),
    worldTransformVersion: 0,
    localBounds: bounds,
    worldBounds: bounds,
    style: {
      fill: "#10b981",
      stroke: "#059669",
      strokeWidth: 1,
      ...style,
    },
  };
}

/**
 * Create a line node
 */
export function createLineNode(
  bounds: Rect,
  style?: Partial<SceneNode & { type: "line" }>["style"]
): SceneNode {
  return {
    id: generateId(),
    type: "line",
    parentId: null,
    childIds: [],
    localTransform: mat3Identity(),
    worldTransformVersion: 0,
    localBounds: bounds,
    worldBounds: bounds,
    style: {
      stroke: "#000000",
      strokeWidth: 2,
      ...style,
    },
  };
}

/**
 * Create a text node
 */
export function createTextNode(
  bounds: Rect,
  text: string,
  style?: Partial<SceneNode & { type: "text" }>["style"]
): SceneNode {
  return {
    id: generateId(),
    type: "text",
    parentId: null,
    childIds: [],
    localTransform: mat3Identity(),
    worldTransformVersion: 0,
    localBounds: bounds,
    worldBounds: bounds,
    style: {
      text,
      fontFamily: "sans-serif",
      fontSize: 16,
      fontWeight: 400,
      align: "left",
      color: "#000000",
      ...style,
    },
  };
}

/**
 * Create a frame node
 */
export function createFrameNode(
  bounds: Rect,
  style?: Partial<SceneNode & { type: "frame" }>["style"]
): SceneNode {
  return {
    id: generateId(),
    type: "frame",
    parentId: null,
    childIds: [],
    localTransform: mat3Identity(),
    worldTransformVersion: 0,
    localBounds: bounds,
    worldBounds: bounds,
    style: {
      fill: "#ffffff",
      ...style,
    },
  };
}

/**
 * Create a group node
 */
export function createGroupNode(bounds: Rect): SceneNode {
  return {
    id: generateId(),
    type: "group",
    parentId: null,
    childIds: [],
    localTransform: mat3Identity(),
    worldTransformVersion: 0,
    localBounds: bounds,
    worldBounds: bounds,
    style: {},
  };
}

/**
 * Create root node for document
 */
export function createRootNode(): SceneNode {
  return createFrameNode(rect(0, 0, 10000, 10000), { fill: "#f8fafc" });
}

/**
 * Clone a node (shallow - doesn't clone children)
 */
export function cloneNode(node: SceneNode): SceneNode {
  return {
    ...node,
    localTransform: new Float32Array(node.localTransform),
    style: { ...node.style },
  } as SceneNode;
}
