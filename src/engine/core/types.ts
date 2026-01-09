/**
 * Core Types - Shared Interface Contract
 * All agents MUST use these shared types and contracts
 */

export type ID = string;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Mat3 is a 3x3 matrix stored in column-major order (9 elements)
export type Mat3 = Float32Array;

export type NodeType = "frame" | "rect" | "ellipse" | "line" | "text" | "group";

export interface SceneNodeBase {
  id: ID;
  type: NodeType;
  parentId: ID | null;
  childIds: ID[];
  localTransform: Mat3;
  worldTransformVersion: number;
  localBounds: Rect;
  worldBounds: Rect;
  style: Record<string, any>;
  name?: string;
  locked?: boolean;
  hidden?: boolean;
}

export type SceneNode =
  | (SceneNodeBase & {
      type: "rect";
      style: {
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        radius?: number;
      };
    })
  | (SceneNodeBase & {
      type: "ellipse";
      style: {
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
      };
    })
  | (SceneNodeBase & {
      type: "line";
      style: {
        stroke?: string;
        strokeWidth?: number;
      };
    })
  | (SceneNodeBase & {
      type: "text";
      style: {
        text: string;
        fontFamily?: string;
        fontSize?: number;
        fontWeight?: number;
        align?: "left" | "center" | "right";
        color?: string;
      };
    })
  | (SceneNodeBase & {
      type: "frame";
      style: {
        fill?: string;
      };
    })
  | (SceneNodeBase & {
      type: "group";
      style: Record<string, never>;
    });

export interface DocumentModel {
  schemaVersion: number;
  rootId: ID;
  nodes: Record<ID, SceneNode>;
  selection: ID[];
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}

export interface CameraState {
  zoom: number;
  pan: Vec2; // world-space offset
  viewportPx: { w: number; h: number };
  dpr: number;
}

export interface RenderSurface {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext | null;
  ctx2d: CanvasRenderingContext2D | null;
}

export interface Renderer {
  setSurface(surface: RenderSurface): void;
  setCamera(camera: CameraState): void;
  setDocument(doc: DocumentModel): void;
  requestFrame(reason?: string): void;
  renderFrame(nowMs: number): void;
  destroy(): void;
}

export type ToolId = "select" | "pan" | "rect" | "ellipse" | "line" | "text";

export interface ToolContext {
  store: EngineStore;
  camera: CameraState;
  hitTestWorld(pt: Vec2): { hitId: ID | null; hits: ID[] };
  toWorld(ptPx: Vec2): Vec2;
  toScreen(world: Vec2): Vec2;
  snap(
    world: Vec2,
    options?: { includeGrid?: boolean; includeObjects?: boolean }
  ): { snapped: Vec2; guides: any[] };
  requestRender(reason?: string): void;
}

export interface Tool {
  id: ToolId;
  onPointerDown(e: PointerEvent, ctx: ToolContext): void;
  onPointerMove(e: PointerEvent, ctx: ToolContext): void;
  onPointerUp(e: PointerEvent, ctx: ToolContext): void;
  onKeyDown?(e: KeyboardEvent, ctx: ToolContext): void;
  onCancel?(ctx: ToolContext): void;
}

export interface Command {
  id: string;
  name: string;
  do(doc: DocumentModel): DocumentModel;
  undo(doc: DocumentModel): DocumentModel;
  merge?(next: Command): Command | null;
}

export interface StorageAdapter {
  load(): Promise<DocumentModel>;
  save(doc: DocumentModel): Promise<void>;
  export(doc: DocumentModel): Promise<Blob>;
  import(blob: Blob): Promise<DocumentModel>;
}

export interface EngineStore {
  get(): DocumentModel;
  subscribe(selector: (doc: DocumentModel) => any, cb: (value: any) => void): () => void;
  dispatch(action: any): void;
}
