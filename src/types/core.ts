/**
 * Core type definitions for the design canvas system.
 * These types form the foundation of the scene graph and rendering pipeline.
 */

import { mat3, vec2 } from 'gl-matrix';

// ============================================================================
// ID & Basic Types
// ============================================================================

export type NodeId = string;
export type CommandId = string;

// ============================================================================
// Transform & Geometry Types
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  /** 3x3 transformation matrix for 2D transforms */
  matrix: mat3;
  /** Individual transform components for editing */
  position: vec2;
  rotation: number; // radians
  scale: vec2;
}

// ============================================================================
// Style Types
// ============================================================================

export interface Fill {
  type: 'solid' | 'gradient' | 'image';
  color?: string; // rgba or hex
  opacity?: number;
}

export interface Stroke {
  color: string;
  width: number;
  opacity?: number;
  dashArray?: number[];
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  lineHeight: number;
  letterSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  color: string;
}

export interface NodeStyle {
  fill?: Fill;
  stroke?: Stroke;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
}

// ============================================================================
// Scene Node Types
// ============================================================================

export const NodeType = {
  Frame: 'FRAME',
  Rectangle: 'RECTANGLE',
  Ellipse: 'ELLIPSE',
  Line: 'LINE',
  Text: 'TEXT',
  Group: 'GROUP',
} as const;

export type NodeType = typeof NodeType[keyof typeof NodeType];

export interface BaseNode {
  id: NodeId;
  type: NodeType;
  name: string;
  transform: Transform;
  bounds: Bounds;
  style: NodeStyle;
  children?: SceneNode[];
  parent?: NodeId;
  /** Z-index within parent */
  zIndex: number;
}

export interface FrameNode extends BaseNode {
  type: typeof NodeType.Frame;
  clipsContent: boolean;
  backgroundColor?: string;
}

export interface RectangleNode extends BaseNode {
  type: typeof NodeType.Rectangle;
  cornerRadius?: number;
}

export interface EllipseNode extends BaseNode {
  type: typeof NodeType.Ellipse;
}

export interface LineNode extends BaseNode {
  type: typeof NodeType.Line;
  startPoint: Point;
  endPoint: Point;
}

export interface TextNode extends BaseNode {
  type: typeof NodeType.Text;
  content: string;
  textStyle: TextStyle;
}

export interface GroupNode extends BaseNode {
  type: typeof NodeType.Group;
}

export type SceneNode =
  | FrameNode
  | RectangleNode
  | EllipseNode
  | LineNode
  | TextNode
  | GroupNode;

// ============================================================================
// Camera & Viewport Types
// ============================================================================

export interface Camera {
  /** Camera position in world space */
  position: vec2;
  /** Zoom level (1.0 = 100%) */
  zoom: number;
  /** View transform matrix (world -> screen) */
  viewMatrix: mat3;
  /** Inverse view matrix (screen -> world) */
  inverseViewMatrix: mat3;
}

export interface Viewport {
  width: number;
  height: number;
  /** Device pixel ratio for high-DPI displays */
  pixelRatio: number;
}

// ============================================================================
// Rendering Types
// ============================================================================

export interface RenderContext {
  camera: Camera;
  viewport: Viewport;
  /** Nodes visible in current viewport */
  visibleNodes: SceneNode[];
  /** Selected nodes */
  selectedNodes: NodeId[];
  /** Hovered node */
  hoveredNode?: NodeId;
}

export const RenderLayer = {
  Background: 0,
  Grid: 1,
  Shapes: 2,
  Selection: 3,
  Guides: 4,
  Overlay: 5,
} as const;

export type RenderLayer = typeof RenderLayer[keyof typeof RenderLayer];

// ============================================================================
// Interaction Types
// ============================================================================

export const ToolType = {
  Select: 'SELECT',
  Pan: 'PAN',
  Rectangle: 'RECTANGLE',
  Ellipse: 'ELLIPSE',
  Line: 'LINE',
  Text: 'TEXT',
} as const;

export type ToolType = typeof ToolType[keyof typeof ToolType];

export interface PointerState {
  position: Point;
  worldPosition: Point;
  buttons: number;
  button: number;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  pressure?: number;
  pointerType: 'mouse' | 'pen' | 'touch';
}

export interface DragState {
  start: Point;
  current: Point;
  worldStart: Point;
  worldCurrent: Point;
  delta: Point;
  isDragging: boolean;
}

// ============================================================================
// Selection Types
// ============================================================================

export interface SelectionState {
  selectedIds: Set<NodeId>;
  hoveredId?: NodeId;
  marquee?: Bounds;
}

export const ResizeHandle = {
  TopLeft: 'TL',
  TopRight: 'TR',
  BottomLeft: 'BL',
  BottomRight: 'BR',
  Top: 'T',
  Right: 'R',
  Bottom: 'B',
  Left: 'L',
} as const;

export type ResizeHandle = typeof ResizeHandle[keyof typeof ResizeHandle];

export interface TransformHandle {
  type: 'resize' | 'rotate';
  handle?: ResizeHandle;
  position: Point;
  cursor: string;
}

// ============================================================================
// Snapping Types
// ============================================================================

export interface SnapGuide {
  type: 'edge' | 'center' | 'grid';
  axis: 'x' | 'y';
  value: number;
  /** Nodes that contribute to this guide */
  nodes?: NodeId[];
}

export interface SnapResult {
  snapped: boolean;
  guides: SnapGuide[];
  position: Point;
}

// ============================================================================
// Document Types
// ============================================================================

export interface DocumentMetadata {
  version: string;
  createdAt: number;
  modifiedAt: number;
  name: string;
}

export interface Document {
  metadata: DocumentMetadata;
  root: SceneNode;
  camera: Camera;
}

// ============================================================================
// History Types
// ============================================================================

export interface Command {
  id: CommandId;
  type: string;
  timestamp: number;
  execute(): void;
  undo(): void;
  canMerge?(other: Command): boolean;
  merge?(other: Command): void;
}

export interface HistoryState {
  commands: Command[];
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
}
