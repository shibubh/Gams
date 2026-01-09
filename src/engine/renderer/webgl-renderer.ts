/**
 * WebGL2 Renderer - Main rendering engine
 */

import type {
  Renderer,
  RenderSurface,
  CameraState,
  DocumentModel,
  SceneNode,
  Rect,
} from "../core/types";
import { getCameraMatrix, rectIntersects, rect } from "../core/math";
import { RectRenderer } from "./rect-renderer";
import { SelectionRenderer } from "./selection-renderer";
import { GridRenderer } from "./grid-renderer";

export class WebGL2Renderer implements Renderer {
  private surface: RenderSurface | null = null;
  private camera: CameraState | null = null;
  private document: DocumentModel | null = null;
  private frameRequested = false;
  private rafId: number | null = null;
  
  // Sub-renderers
  private gridRenderer: GridRenderer | null = null;
  private rectRenderer: RectRenderer | null = null;
  private selectionRenderer: SelectionRenderer | null = null;

  setSurface(surface: RenderSurface): void {
    this.surface = surface;
    
    if (surface.gl) {
      // Initialize WebGL2 renderers
      this.gridRenderer = new GridRenderer(surface.gl);
      this.rectRenderer = new RectRenderer(surface.gl);
      this.selectionRenderer = new SelectionRenderer(surface.gl);
    }
  }

  setCamera(camera: CameraState): void {
    this.camera = camera;
    this.requestFrame("camera update");
  }

  setDocument(doc: DocumentModel): void {
    this.document = doc;
    this.requestFrame("document update");
  }

  requestFrame(_reason?: string): void {
    if (this.frameRequested) return;
    this.frameRequested = true;
    
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    
    this.rafId = requestAnimationFrame((nowMs) => {
      this.renderFrame(nowMs);
    });
  }

  renderFrame(_nowMs: number): void {
    this.frameRequested = false;
    this.rafId = null;
    
    if (!this.surface || !this.camera || !this.document) return;
    
    const { gl, ctx2d } = this.surface;
    
    if (gl && this.gridRenderer && this.rectRenderer && this.selectionRenderer) {
      this.renderWebGL(gl);
    } else if (ctx2d) {
      this.renderCanvas2D(ctx2d);
    }
  }

  private renderWebGL(gl: WebGL2RenderingContext): void {
    if (!this.camera || !this.document) return;
    
    const { viewportPx, dpr } = this.camera;
    const canvas = gl.canvas as HTMLCanvasElement;
    
    // Update canvas size
    const displayWidth = Math.floor(viewportPx.w * dpr);
    const displayHeight = Math.floor(viewportPx.h * dpr);
    
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
    
    // Set viewport
    gl.viewport(0, 0, displayWidth, displayHeight);
    
    // Clear
    gl.clearColor(0.97, 0.98, 0.99, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    const cameraMatrix = getCameraMatrix(this.camera);
    const viewportRect = this.getViewportRect();
    
    // Render layers
    this.gridRenderer?.render(this.camera, cameraMatrix);
    this.renderShapes(gl, cameraMatrix, viewportRect);
    this.selectionRenderer?.render(
      this.camera,
      cameraMatrix,
      this.document.selection,
      this.document.nodes
    );
  }

  private renderShapes(
    _gl: WebGL2RenderingContext,
    cameraMatrix: Float32Array,
    viewportRect: Rect
  ): void {
    if (!this.document || !this.rectRenderer) return;
    
    // Collect visible nodes
    const visibleNodes: SceneNode[] = [];
    
    for (const nodeId in this.document.nodes) {
      const node = this.document.nodes[nodeId];
      
      // Skip hidden nodes
      if (node.hidden) continue;
      
      // Skip root node
      if (nodeId === this.document.rootId) continue;
      
      // Cull by viewport
      if (rectIntersects(node.worldBounds, viewportRect)) {
        visibleNodes.push(node);
      }
    }
    
    // Render rectangles
    const rectNodes = visibleNodes.filter((n) => n.type === "rect");
    this.rectRenderer.renderBatch(cameraMatrix, rectNodes as any);
  }

  private renderCanvas2D(ctx: CanvasRenderingContext2D): void {
    if (!this.camera || !this.document) return;
    
    const { viewportPx } = this.camera;
    const canvas = ctx.canvas;
    
    // Update canvas size
    if (canvas.width !== viewportPx.w || canvas.height !== viewportPx.h) {
      canvas.width = viewportPx.w;
      canvas.height = viewportPx.h;
    }
    
    // Clear
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, viewportPx.w, viewportPx.h);
    
    const cameraMatrix = getCameraMatrix(this.camera);
    const viewportRect = this.getViewportRect();
    
    // Simple Canvas2D rendering
    ctx.save();
    
    // Apply camera transform
    const m = cameraMatrix;
    ctx.setTransform(m[0], m[1], m[3], m[4], m[6], m[7]);
    
    // Render grid
    this.renderCanvas2DGrid(ctx);
    
    // Render shapes
    for (const nodeId in this.document.nodes) {
      const node = this.document.nodes[nodeId];
      
      if (node.hidden || nodeId === this.document.rootId) continue;
      if (!rectIntersects(node.worldBounds, viewportRect)) continue;
      
      this.renderCanvas2DNode(ctx, node);
    }
    
    // Render selection
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2 / this.camera.zoom;
    for (const selectedId of this.document.selection) {
      const node = this.document.nodes[selectedId];
      if (node) {
        const b = node.worldBounds;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
    }
    
    ctx.restore();
  }

  private renderCanvas2DGrid(ctx: CanvasRenderingContext2D): void {
    if (!this.camera) return;
    
    const { zoom, pan, viewportPx } = this.camera;
    const gridSize = 50;
    
    // Calculate visible grid range
    const startX = Math.floor(pan.x / gridSize) * gridSize;
    const endX = Math.ceil((pan.x + viewportPx.w / zoom) / gridSize) * gridSize;
    const startY = Math.floor(pan.y / gridSize) * gridSize;
    const endY = Math.ceil((pan.y + viewportPx.h / zoom) / gridSize) * gridSize;
    
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1 / zoom;
    
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  }

  private renderCanvas2DNode(ctx: CanvasRenderingContext2D, node: SceneNode): void {
    const b = node.worldBounds;
    
    if (node.type === "rect") {
      if (node.style.fill) {
        ctx.fillStyle = node.style.fill;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      if (node.style.stroke) {
        ctx.strokeStyle = node.style.stroke;
        ctx.lineWidth = (node.style.strokeWidth || 1) / (this.camera?.zoom || 1);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
    } else if (node.type === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(
        b.x + b.w / 2,
        b.y + b.h / 2,
        b.w / 2,
        b.h / 2,
        0,
        0,
        Math.PI * 2
      );
      if (node.style.fill) {
        ctx.fillStyle = node.style.fill;
        ctx.fill();
      }
      if (node.style.stroke) {
        ctx.strokeStyle = node.style.stroke;
        ctx.lineWidth = (node.style.strokeWidth || 1) / (this.camera?.zoom || 1);
        ctx.stroke();
      }
    }
  }

  private getViewportRect(): Rect {
    if (!this.camera) return rect(0, 0, 0, 0);
    
    const { pan, viewportPx, zoom } = this.camera;
    
    return rect(
      pan.x - 100 / zoom,
      pan.y - 100 / zoom,
      viewportPx.w / zoom + 200 / zoom,
      viewportPx.h / zoom + 200 / zoom
    );
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    
    this.gridRenderer?.destroy();
    this.rectRenderer?.destroy();
    this.selectionRenderer?.destroy();
  }
}
