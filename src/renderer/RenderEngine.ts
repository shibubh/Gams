/**
 * Main render engine that orchestrates the rendering pipeline.
 * Handles layer-based rendering, viewport culling, and render loop.
 */

import { CameraController } from '../engine/camera';
import { WebGLRenderer } from './webgl/WebGLRenderer';
import { Canvas2DRenderer } from './canvas2d/Canvas2DRenderer';
import type {
  SceneNode,
  NodeId,
  LineNode,
  TextNode,
} from '../types/core';
import { NodeType } from '../types/core';

export interface RenderEngineOptions {
  preferWebGL?: boolean;
  antialias?: boolean;
}

export class RenderEngine {
  private canvas: HTMLCanvasElement;
  private camera: CameraController;
  private renderer: WebGLRenderer | Canvas2DRenderer;
  private useWebGL: boolean;
  private animationFrameId: number | null = null;
  private scene: SceneNode | null = null;
  private selectedNodes: Set<NodeId> = new Set();
  private hoveredNode: NodeId | null = null;
  private isDirty: boolean = true;

  constructor(
    canvas: HTMLCanvasElement,
    options: RenderEngineOptions = {}
  ) {
    this.canvas = canvas;

    // Initialize camera
    this.camera = new CameraController({
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      pixelRatio: window.devicePixelRatio || 1,
    });

    // Initialize renderer (WebGL2 with Canvas2D fallback)
    this.useWebGL = options.preferWebGL !== false;
    
    try {
      if (this.useWebGL) {
        this.renderer = new WebGLRenderer(canvas, {
          antialias: options.antialias,
        });
      } else {
        throw new Error('WebGL disabled by options');
      }
    } catch (e) {
      console.warn('WebGL2 not available, falling back to Canvas2D:', e);
      this.useWebGL = false;
      this.renderer = new Canvas2DRenderer(canvas);
    }

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    resizeObserver.observe(this.canvas);
  }

  private handleResize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const pixelRatio = window.devicePixelRatio || 1;

    this.camera.updateViewport(width, height, pixelRatio);
    this.renderer.resize(width, height);
    this.markDirty();
  }

  /**
   * Set the scene to render.
   */
  setScene(scene: SceneNode): void {
    this.scene = scene;
    this.markDirty();
  }

  /**
   * Set selected nodes.
   */
  setSelection(nodeIds: NodeId[]): void {
    this.selectedNodes = new Set(nodeIds);
    this.markDirty();
  }

  /**
   * Set hovered node.
   */
  setHovered(nodeId: NodeId | null): void {
    if (this.hoveredNode !== nodeId) {
      this.hoveredNode = nodeId;
      this.markDirty();
    }
  }

  /**
   * Mark the canvas as dirty (needs redraw).
   */
  markDirty(): void {
    this.isDirty = true;
  }

  /**
   * Get the camera controller.
   */
  getCamera(): CameraController {
    return this.camera;
  }

  /**
   * Start the render loop.
   */
  start(): void {
    if (this.animationFrameId !== null) return;

    const renderLoop = () => {
      if (this.isDirty) {
        this.render();
        this.isDirty = false;
      }
      this.animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  }

  /**
   * Stop the render loop.
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main render function.
   */
  private render(): void {
    if (!this.scene) return;

    // Clear canvas
    this.renderer.clear();

    // Get visible nodes through viewport culling
    const visibleNodes = this.cullNodes(this.scene);

    if (this.useWebGL) {
      this.renderWebGL(visibleNodes);
    } else {
      this.renderCanvas2D(visibleNodes);
    }
  }

  /**
   * Viewport culling - only render visible nodes.
   */
  private cullNodes(root: SceneNode): SceneNode[] {
    const visible: SceneNode[] = [];

    const traverse = (node: SceneNode) => {
      // Check if node is in viewport
      if (this.camera.isInViewport(node.bounds)) {
        visible.push(node);
      }

      // Traverse children
      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    traverse(root);
    return visible;
  }

  /**
   * Render using WebGL.
   */
  private renderWebGL(nodes: SceneNode[]): void {
    const renderer = this.renderer as WebGLRenderer;
    const camera = this.camera.getCamera();

    // Layer 1: Grid (optional)
    // renderer.renderGrid(camera.viewMatrix, camera.zoom);

    // Layer 2: Shapes
    nodes.forEach((node) => {
      this.renderNodeWebGL(node, renderer, camera.viewMatrix as unknown as Float32Array);
    });

    // Layer 3: Selection with resize handles
    nodes.forEach((node) => {
      if (this.selectedNodes.has(node.id)) {
        renderer.renderSelection(
          node.bounds.x,
          node.bounds.y,
          node.bounds.width,
          node.bounds.height,
          camera.viewMatrix
        );
        // Render resize handles
        renderer.renderResizeHandles(
          node.bounds.x,
          node.bounds.y,
          node.bounds.width,
          node.bounds.height,
          camera.viewMatrix,
          camera.zoom
        );
      }
    });
  }

  /**
   * Render using Canvas2D.
   */
  private renderCanvas2D(nodes: SceneNode[]): void {
    const renderer = this.renderer as Canvas2DRenderer;
    const camera = this.camera.getCamera();

    // Apply camera transform
    renderer.applyCamera(camera);

    // Layer 1: Grid
    // renderer.renderGrid(camera.zoom, camera.position[0], camera.position[1]);

    // Layer 2: Shapes
    nodes.forEach((node) => {
      this.renderNodeCanvas2D(node, renderer);
    });

    // Layer 3: Selection with resize handles
    nodes.forEach((node) => {
      if (this.selectedNodes.has(node.id)) {
        renderer.renderSelection(
          node.bounds.x,
          node.bounds.y,
          node.bounds.width,
          node.bounds.height
        );
        // Render resize handles
        renderer.renderResizeHandles(
          node.bounds.x,
          node.bounds.y,
          node.bounds.width,
          node.bounds.height,
          camera.zoom
        );
      }
    });

    renderer.restore();
  }

  /**
   * Render individual node with WebGL.
   */
  private renderNodeWebGL(
    node: SceneNode,
    renderer: WebGLRenderer,
    viewMatrix: Float32Array
  ): void {
    if (!node.style.visible) return;

    switch (node.type) {
      case NodeType.Rectangle:
      case NodeType.Frame: {
        const color = node.style.fill?.color || '#ffffff';
        renderer.renderRectangle(
          node.bounds.x,
          node.bounds.y,
          node.bounds.width,
          node.bounds.height,
          color,
          viewMatrix
        );
        break;
      }
      case NodeType.Ellipse: {
        const color = node.style.fill?.color || '#60a5fa';
        renderer.renderEllipse(
          node.bounds.x,
          node.bounds.y,
          node.bounds.width,
          node.bounds.height,
          color,
          viewMatrix
        );
        break;
      }
      // Add other node types here
    }
  }

  /**
   * Render individual node with Canvas2D.
   */
  private renderNodeCanvas2D(
    node: SceneNode,
    renderer: Canvas2DRenderer
  ): void {
    if (!node.style.visible) return;

    switch (node.type) {
      case NodeType.Rectangle:
      case NodeType.Frame: {
        const fillColor = node.style.fill?.color;
        const strokeColor = node.style.stroke?.color;
        const strokeWidth = node.style.stroke?.width || 1;
        
        renderer.renderRectangle(
          node.bounds.x,
          node.bounds.y,
          node.bounds.width,
          node.bounds.height,
          fillColor,
          strokeColor,
          strokeWidth
        );
        break;
      }

      case NodeType.Ellipse: {
        const fillColor = node.style.fill?.color;
        const strokeColor = node.style.stroke?.color;
        const strokeWidth = node.style.stroke?.width || 1;

        renderer.renderEllipse(
          node.bounds.x,
          node.bounds.y,
          node.bounds.width / 2,
          node.bounds.height / 2,
          fillColor,
          strokeColor,
          strokeWidth
        );
        break;
      }

      case NodeType.Line: {
        const line = node as LineNode;
        const strokeColor = node.style.stroke?.color || '#000000';
        const strokeWidth = node.style.stroke?.width || 1;

        renderer.renderLine(
          line.startPoint.x,
          line.startPoint.y,
          line.endPoint.x,
          line.endPoint.y,
          strokeColor,
          strokeWidth
        );
        break;
      }

      case NodeType.Text: {
        const text = node as TextNode;
        renderer.renderText(
          text.content,
          node.bounds.x,
          node.bounds.y + text.textStyle.fontSize,
          text.textStyle.fontSize,
          text.textStyle.fontFamily,
          text.textStyle.color
        );
        break;
      }
    }
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    this.stop();
    if (this.useWebGL) {
      (this.renderer as WebGLRenderer).dispose();
    }
  }
}
