/**
 * Tool Router - Manages active tool and pointer events
 */

import type { Tool, ToolContext, ToolId, EngineStore, CameraState, Vec2 } from "../core/types";
import { screenToWorld, worldToScreen } from "../core/math";
import { SpatialIndex } from "./spatial-index";
import { SnappingService } from "./snapping-service";
import { SelectTool } from "./tools/select-tool";
import { PanTool } from "./tools/pan-tool";
import { RectTool } from "./tools/rect-tool";

export class ToolRouter {
  private tools: Map<ToolId, Tool>;
  private activeTool: Tool;
  private store: EngineStore;
  private camera: CameraState;
  private spatialIndex: SpatialIndex;
  private snappingService: SnappingService;
  private renderCallback: (reason?: string) => void;

  constructor(
    store: EngineStore,
    camera: CameraState,
    renderCallback: (reason?: string) => void
  ) {
    this.store = store;
    this.camera = camera;
    this.renderCallback = renderCallback;
    this.spatialIndex = new SpatialIndex();
    this.snappingService = new SnappingService();

    // Register tools
    this.tools = new Map();
    this.tools.set("select", new SelectTool());
    this.tools.set("pan", new PanTool());
    this.tools.set("rect", new RectTool());

    this.activeTool = this.tools.get("select")!;

    // Subscribe to document changes to rebuild spatial index
    this.store.subscribe(
      (doc) => doc.nodes,
      () => {
        const doc = this.store.get();
        this.spatialIndex.rebuild(doc.nodes, doc.rootId);
      }
    );
  }

  setActiveTool(toolId: ToolId): void {
    const tool = this.tools.get(toolId);
    if (!tool) {
      console.warn(`Tool ${toolId} not found`);
      return;
    }

    // Cancel current tool
    this.activeTool.onCancel?.(this.createContext());

    this.activeTool = tool;
    this.renderCallback("tool changed");
  }

  getActiveTool(): Tool {
    return this.activeTool;
  }

  handlePointerDown(e: PointerEvent): void {
    const ctx = this.createContext();
    this.activeTool.onPointerDown(e, ctx);
  }

  handlePointerMove(e: PointerEvent): void {
    const ctx = this.createContext();
    this.activeTool.onPointerMove(e, ctx);
  }

  handlePointerUp(e: PointerEvent): void {
    const ctx = this.createContext();
    this.activeTool.onPointerUp(e, ctx);
  }

  handleKeyDown(e: KeyboardEvent): void {
    const ctx = this.createContext();
    this.activeTool.onKeyDown?.(e, ctx);
  }

  handleWheel(e: WheelEvent): void {
    e.preventDefault();

    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // Get world point before zoom
    const worldPtBefore = screenToWorld(screenPt, this.camera);

    // Update zoom
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoom = Math.max(0.1, Math.min(10, this.camera.zoom * zoomDelta));

    // Get world point after zoom (with same screen point)
    const worldPtAfter = screenToWorld(screenPt, this.camera);

    // Adjust pan to keep world point under cursor
    this.camera.pan.x += worldPtBefore.x - worldPtAfter.x;
    this.camera.pan.y += worldPtBefore.y - worldPtAfter.y;

    this.renderCallback("zoom");
  }

  private createContext(): ToolContext {
    const doc = this.store.get();

    return {
      store: this.store,
      camera: this.camera,
      
      hitTestWorld: (pt: Vec2) => {
        return this.spatialIndex.hitTest(pt, doc.nodes);
      },
      
      toWorld: (ptPx: Vec2) => {
        return screenToWorld(ptPx, this.camera);
      },
      
      toScreen: (world: Vec2) => {
        return worldToScreen(world, this.camera);
      },
      
      snap: (world: Vec2, options) => {
        return this.snappingService.snap(world, doc.nodes, doc.rootId, options);
      },
      
      requestRender: (reason?: string) => {
        this.renderCallback(reason);
      },
    };
  }

  updateCamera(camera: CameraState): void {
    this.camera = camera;
  }

  destroy(): void {
    // Cleanup
  }
}
