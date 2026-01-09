/**
 * Main render engine that orchestrates the rendering pipeline.
 * Handles layer-based rendering, viewport culling (via WASM), and render loop.
 */

import { CameraController } from '../engine/camera';
import { WasmAdapter } from '../engine/wasm/WasmAdapter';
import { WebGLRenderer } from './webgl/WebGLRenderer';
import { Canvas2DRenderer } from './canvas2d/Canvas2DRenderer';
import {
  getMarginPaddingVisualization,
  calculateDistanceGuides
} from './VisualGuides';
import type {
  SceneNode,
  NodeId,
  LineNode,
  TextNode,
} from '../types/core';
import { NodeType } from '../types/core';
import { collectAllNodes, findNode } from '../engine/scene/sceneGraph';
import type { NodeStyleExtended } from '../types/styles';
import { useAppStore } from '../state/store';

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
  
  // WASM performance layer
  private wasmAdapter: WasmAdapter;
  private wasmInitialized: boolean = false;
  
  // Performance tracking
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fps: number = 60;

  constructor(
    canvas: HTMLCanvasElement,
    options: RenderEngineOptions = {}
  ) {
    this.canvas = canvas;
    this.wasmAdapter = new WasmAdapter();

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
    this.initWasm();
  }

  /**
   * Initialize WASM adapter (async)
   */
  private async initWasm(): Promise<void> {
    try {
      await this.wasmAdapter.init({ capacity: 100000 });
      this.wasmInitialized = true;
      console.log('[RenderEngine] WASM initialized');
    } catch (error) {
      console.error('[RenderEngine] WASM initialization failed:', error);
      // Continue without WASM (fallback to JS culling)
    }
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
    
    // Update WASM camera
    if (this.wasmInitialized) {
      const cam = this.camera.getCamera();
      this.wasmAdapter.setCamera(
        cam.zoom,
        cam.position[0],
        cam.position[1],
        width,
        height,
        pixelRatio
      );
    }
    
    this.markDirty();
  }

  /**
   * Set the scene to render.
   */
  setScene(scene: SceneNode): void {
    this.scene = scene;
    
    // Update WASM spatial index
    if (this.wasmInitialized) {
      const startTime = performance.now();
      this.wasmAdapter.updateFromScene(scene);
      const elapsed = performance.now() - startTime;
      
      if (elapsed > 10) {
        console.warn(`[RenderEngine] WASM update took ${elapsed.toFixed(2)}ms`);
      }
    }
    
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
   * Get the WASM adapter.
   */
  getWasmAdapter(): WasmAdapter {
    return this.wasmAdapter;
  }

  /**
   * Start the render loop.
   */
  start(): void {
    if (this.animationFrameId !== null) return;

    const renderLoop = (timestamp: number) => {
      // Calculate FPS
      if (this.lastFrameTime > 0) {
        const delta = timestamp - this.lastFrameTime;
        this.fps = 1000 / delta;
        this.frameCount++;
      }
      this.lastFrameTime = timestamp;

      if (this.isDirty) {
        const frameStart = performance.now();
        this.render();
        this.isDirty = false;
        
        const frameTime = performance.now() - frameStart;
        
        // Log slow frames
        if (frameTime > 16.67) {
          console.warn(`[RenderEngine] Slow frame: ${frameTime.toFixed(2)}ms`);
        }
        
        // Dispatch performance metrics
        this.dispatchPerformanceMetrics(frameTime);
      }
      
      this.animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop(performance.now());
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

    // Get visible nodes through WASM or fallback to JS culling
    const visibleNodes = this.getVisibleNodes();

    if (this.useWebGL) {
      this.renderWebGL(visibleNodes);
    } else {
      this.renderCanvas2D(visibleNodes);
    }
  }

  /**
   * Get visible nodes using WASM culling or fallback to JS
   */
  private getVisibleNodes(): SceneNode[] {
    if (!this.scene) return [];
    
    const cullStart = performance.now();
    
    if (this.wasmInitialized) {
      // WASM-accelerated culling
      const visibleIds = this.wasmAdapter.getVisibleNodes();
      const allNodes = collectAllNodes(this.scene);
      const nodeMap = new Map(allNodes.map(n => [n.id, n]));
      const visible = visibleIds
        .map(id => nodeMap.get(id))
        .filter((n): n is SceneNode => n !== undefined);
      
      const cullTime = performance.now() - cullStart;
      this.lastCullTime = cullTime;
      
      return visible;
    } else {
      // Fallback: JS culling
      const visible = this.cullNodesJS(this.scene);
      const cullTime = performance.now() - cullStart;
      this.lastCullTime = cullTime;
      
      return visible;
    }
  }
  
  private lastCullTime: number = 0;
  private lastHitTestTime: number = 0;

  /**
   * Viewport culling - only render visible nodes (JS fallback).
   */
  private cullNodesJS(root: SceneNode): SceneNode[] {
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
    const appState = useAppStore.getState();
    
    // Pre-calculate visible node IDs for smart guide calculations
    const visibleNodeIds = this.wasmInitialized ? nodes.map(n => n.id) : [];

    // Layer 0: Grid
    renderer.renderGrid(camera.viewMatrix, camera.zoom);

    // Layer 1: Shapes
    nodes.forEach((node) => {
      this.renderNodeWebGL(node, renderer, camera.viewMatrix as unknown as Float32Array);
    });

    // Layer 2: Selection with resize handles
    nodes.forEach((node) => {
      if (this.selectedNodes.has(node.id)) {
        renderer.renderSelection(
          node.bounds.x,
          node.bounds.y,
          node.bounds.width,
          node.bounds.height,
          camera.viewMatrix
        );
        // Render resize handles (only when not dragging)
        if (!appState.isDragging) {
          renderer.renderResizeHandles(
            node.bounds.x,
            node.bounds.y,
            node.bounds.width,
            node.bounds.height,
            camera.viewMatrix,
            camera.zoom
          );
        }
      }
    });

    // Layer 3: Figma-style Smart Guides
    // During drag/resize: show alignment and spacing guides
    if ((appState.isDragging || appState.isResizing) && appState.draggedNodes.size > 0 && this.scene && this.wasmInitialized) {
      const draggedId = Array.from(appState.draggedNodes)[0];
      const draggedNode = findNode(this.scene, draggedId);

      if (draggedNode) {
        // Get all nodes from scene to find parent (not just visible nodes)
        const allNodes = collectAllNodes(this.scene);
        
        // Alignment guides (magenta lines when edges/centers align) - use WASM
        const alignmentGuides = this.wasmAdapter.calculateAlignmentGuides(draggedId, visibleNodeIds);
        alignmentGuides.forEach(guide => {
          // Convert WASM guide format to renderer format
          const guideForRenderer = {
            type: guide.type,
            position: guide.position,
            alignmentType: guide.alignmentType,
            nodes: [], // We don't need node IDs for rendering, just the count
          };
          renderer.renderAlignmentGuide(guideForRenderer, camera.viewMatrix, camera.zoom);
        });

        // Spacing guides (show when spacing is equal) - use WASM
        const spacingGuides = this.wasmAdapter.calculateSpacingGuides(draggedId, visibleNodeIds);
        spacingGuides.forEach(guide => {
          // Convert WASM guide format to renderer format
          const guideForRenderer = {
            type: guide.type,
            from: guide.from,
            to: guide.to,
            spacing: guide.spacing,
            label: `${Math.round(guide.spacing)}`,
          };
          renderer.renderSpacingGuide(guideForRenderer, camera.viewMatrix, camera.zoom);
        });

        // Distance measurements (to nearest objects or parent bounds) - use WASM
        const parentBounds = this.findParentBounds(draggedNode, allNodes);
        const measurements = this.wasmAdapter.calculateDistanceMeasurements(draggedId, visibleNodeIds, parentBounds);
        measurements.forEach(measurement => {
          // Convert WASM measurement format to renderer format
          const measurementForRenderer = {
            from: measurement.from,
            to: measurement.to,
            direction: measurement.direction,
            distance: measurement.distance,
            label: `${Math.round(measurement.distance)}`,
          };
          renderer.renderDistanceMeasurement(measurementForRenderer, camera.viewMatrix, camera.zoom);
        });
      }
    }

    // When object is selected (not dragging): show distance from all sides
    if (this.selectedNodes.size === 1 && !appState.isDragging && !appState.isResizing && this.scene && this.wasmInitialized) {
      const selectedId = Array.from(this.selectedNodes)[0];
      const selectedNode = findNode(this.scene, selectedId);

      if (selectedNode) {
        // Get all nodes from scene to find parent (not just visible nodes)
        const allNodes = collectAllNodes(this.scene);
        
        // Find parent/container bounds (smallest node that fully contains the selected node)
        const parentBounds = this.findParentBounds(selectedNode, allNodes);

        // Calculate and render distance measurements from all sides - use WASM
        const measurements = this.wasmAdapter.calculateDistanceMeasurements(selectedId, visibleNodeIds, parentBounds);
        measurements.forEach(measurement => {
          // Convert WASM measurement format to renderer format
          const measurementForRenderer = {
            from: measurement.from,
            to: measurement.to,
            direction: measurement.direction,
            distance: measurement.distance,
            label: `${Math.round(measurement.distance)}`,
          };
          renderer.renderDistanceMeasurement(measurementForRenderer, camera.viewMatrix, camera.zoom);
        });
      }
    }

    // Layer 4: Margin/Padding visualization (only when selected and not dragging)
    if (this.selectedNodes.size === 1 && !appState.isDragging && this.scene) {
      const selectedId = Array.from(this.selectedNodes)[0];
      const selectedNode = findNode(this.scene, selectedId);
      
      if (selectedNode) {
        const mpViz = getMarginPaddingVisualization(
          selectedNode,
          selectedNode.style as unknown as NodeStyleExtended
        );
        
        if (mpViz) {
          if (mpViz.margin) {
            renderer.renderMargin(mpViz.bounds, mpViz.margin, camera.viewMatrix, camera.zoom);
          }
          if (mpViz.padding) {
            renderer.renderPadding(mpViz.bounds, mpViz.padding, camera.viewMatrix, camera.zoom);
          }
        }
      }
    }
  }

  /**
   * Render using Canvas2D.
   */
  private renderCanvas2D(nodes: SceneNode[]): void {
    const renderer = this.renderer as Canvas2DRenderer;
    const camera = this.camera.getCamera();

    // Apply camera transform
    renderer.applyCamera(camera);

    // Layer 0: Grid
    renderer.renderGrid(camera.zoom, camera.position[0], camera.position[1]);

    // Layer 1: Shapes
    nodes.forEach((node) => {
      this.renderNodeCanvas2D(node, renderer);
    });

    // Layer 2: Selection with resize handles
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

    // Layer 3: Visual guides (distance measurements)
    if (this.selectedNodes.size === 1 && this.scene) {
      const selectedId = Array.from(this.selectedNodes)[0];
      const selectedNode = findNode(this.scene, selectedId);

      if (selectedNode) {
        const guides = calculateDistanceGuides(selectedNode, nodes, 500);
        guides.forEach(guide => {
          renderer.renderDistanceGuide(
            guide.from,
            guide.to,
            guide.direction,
            guide.label,
            camera.zoom
          );
        });

        // Render margin/padding visualization
        const mpViz = getMarginPaddingVisualization(
          selectedNode,
          selectedNode.style as unknown as NodeStyleExtended
        );
        
        if (mpViz) {
          if (mpViz.margin) {
            renderer.renderMargin(mpViz.bounds, mpViz.margin, camera.zoom);
          }
          if (mpViz.padding) {
            renderer.renderPadding(mpViz.bounds, mpViz.padding, camera.zoom);
          }
        }
      }
    }

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
        const cornerRadius = (node as any).cornerRadius || 0;
        
        renderer.renderRectangle(
          node.bounds.x,
          node.bounds.y,
          node.bounds.width,
          node.bounds.height,
          fillColor,
          strokeColor,
          strokeWidth,
          cornerRadius
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
   * Find the parent/container bounds for a node
   * Returns the bounds of the smallest node that fully contains the selected node
   * Falls back to scene root bounds if no parent container found
   */
  private findParentBounds(
    selectedNode: SceneNode,
    allNodes: SceneNode[]
  ): { x: number; y: number; width: number; height: number } | undefined {
    const bounds = selectedNode.bounds;
    let parentBounds: { x: number; y: number; width: number; height: number } | undefined;
    let smallestArea = Infinity;

    // Find the smallest container that fully contains the selected node
    allNodes.forEach((node) => {
      if (node.id === selectedNode.id) return;

      const nb = node.bounds;
      // Check if this node fully contains the selected node
      if (nb.x <= bounds.x &&
          nb.y <= bounds.y &&
          nb.x + nb.width >= bounds.x + bounds.width &&
          nb.y + nb.height >= bounds.y + bounds.height) {
        const area = nb.width * nb.height;
        // Find the smallest containing node (closest parent)
        if (area < smallestArea) {
          smallestArea = area;
          parentBounds = { x: nb.x, y: nb.y, width: nb.width, height: nb.height };
        }
      }
    });

    // If no parent found but we have a scene, use scene root bounds
    if (!parentBounds && this.scene && this.scene.id !== selectedNode.id) {
      parentBounds = {
        x: this.scene.bounds.x,
        y: this.scene.bounds.y,
        width: this.scene.bounds.width,
        height: this.scene.bounds.height,
      };
    }

    return parentBounds;
  }

  /**
   * Dispatch performance metrics event
   */
  private dispatchPerformanceMetrics(frameTime: number): void {
    const allNodes = this.scene ? collectAllNodes(this.scene) : [];
    const visibleNodes = this.getVisibleNodes();
    
    const event = new CustomEvent('perf-update', {
      detail: {
        fps: this.fps,
        frameTime,
        visibleCount: visibleNodes.length,
        totalCount: allNodes.length,
        cullTime: this.lastCullTime,
        hitTestTime: this.lastHitTestTime,
        wasmNodeCount: this.wasmInitialized ? this.wasmAdapter.getNodeCount() : 0,
      },
    });
    window.dispatchEvent(event);
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
