/**
 * WASM Adapter - High-level TypeScript interface to the WASM core
 * 
 * Handles:
 * - WASM module initialization
 * - ID registry (string <-> u32)
 * - Minimal allocations (reuse typed arrays)
 * - Performance instrumentation
 */

import type { SceneNode, Bounds, NodeId } from '../../types/core';
import { IdRegistry } from './IdRegistry';
import init, { EditorCore } from '../../../public/wasm/editor_core';

export interface WasmAdapterConfig {
  capacity?: number;
  wasmUrl?: string;
}

export interface SnapOptions {
  snapThreshold: number;
  gridSize: number;
  enableGrid: boolean;
  enableObjects: boolean;
}

export interface SnapResultData {
  snapped: boolean;
  x: number;
  y: number;
  guideCount: number;
}

export interface AlignmentGuideData {
  type: 'vertical' | 'horizontal';
  position: number;
  alignmentType: 'edge-left' | 'edge-right' | 'edge-top' | 'edge-bottom' | 'center-x' | 'center-y';
  nodeCount: number;
}

export interface SpacingGuideData {
  type: 'horizontal' | 'vertical';
  from: Bounds;
  to: Bounds;
  spacing: number;
}

export interface DistanceMeasurementData {
  from: { x: number; y: number };
  to: { x: number; y: number };
  direction: 'horizontal' | 'vertical';
  distance: number;
}

export class WasmAdapter {
  private core: EditorCore | null = null;
  private idRegistry: IdRegistry = new IdRegistry();
  private initialized: boolean = false;

  async init(config: WasmAdapterConfig = {}): Promise<void> {
    const { capacity = 10000, wasmUrl = '/wasm/editor_core_bg.wasm' } = config;

    try {
      // Initialize WASM module
      await init(wasmUrl);

      // Create core instance
      this.core = new EditorCore(capacity);
      this.initialized = true;

      console.log('[WASM] Editor core initialized with capacity:', capacity);
    } catch (error) {
      console.error('[WASM] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Update a node in the spatial index
   */
  upsertNode(
    id: NodeId,
    bounds: Bounds,
    zIndex: number,
    flags: { hidden?: boolean; locked?: boolean }
  ): void {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const handle = this.idRegistry.getHandle(id);
    const flagBits = (flags.hidden ? 0x1 : 0) | (flags.locked ? 0x2 : 0);

    this.core.upsert_node(
      handle,
      bounds.x,
      bounds.y,
      bounds.x + bounds.width,
      bounds.y + bounds.height,
      zIndex,
      flagBits
    );
  }

  /**
   * Remove a node from the spatial index
   */
  removeNode(id: NodeId): void {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const handle = this.idRegistry.getHandle(id);
    this.core.remove_node(handle);
    this.idRegistry.remove(id);
  }

  /**
   * Update camera transform
   */
  setCamera(
    zoom: number,
    panX: number,
    panY: number,
    viewportW: number,
    viewportH: number,
    dpr: number = 1
  ): void {
    if (!this.core) throw new Error('[WASM] Not initialized');
    this.core.set_camera(zoom, panX, panY, viewportW, viewportH, dpr);
  }

  /**
   * Get visible node IDs (viewport culling)
   */
  getVisibleNodes(): NodeId[] {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const startTime = performance.now();
    const handlesArray = this.core.cull_visible();
    
    // Convert Uint32Array to NodeId[]
    const ids: NodeId[] = [];
    for (let i = 0; i < handlesArray.length; i++) {
      const id = this.idRegistry.getId(handlesArray[i]);
      if (id) ids.push(id);
    }

    const elapsed = performance.now() - startTime;
    if (elapsed > 2) {
      console.warn(`[WASM] Culling took ${elapsed.toFixed(2)}ms`);
    }

    return ids;
  }

  /**
   * Hit test at world point (returns topmost first)
   */
  hitTestPoint(worldX: number, worldY: number): NodeId[] {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const startTime = performance.now();
    const handlesArray = this.core.hit_test_point(worldX, worldY);
    
    // Convert Uint32Array to NodeId[]
    const ids: NodeId[] = [];
    for (let i = 0; i < handlesArray.length; i++) {
      const id = this.idRegistry.getId(handlesArray[i]);
      if (id) ids.push(id);
    }

    const elapsed = performance.now() - startTime;
    if (elapsed > 2) {
      console.warn(`[WASM] Hit test took ${elapsed.toFixed(2)}ms`);
    }

    return ids;
  }

  /**
   * Query nodes in rectangle
   */
  queryRect(bounds: Bounds): NodeId[] {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const handlesArray = this.core.query_rect(
      bounds.x,
      bounds.y,
      bounds.x + bounds.width,
      bounds.y + bounds.height
    );

    // Convert Uint32Array to NodeId[]
    const ids: NodeId[] = [];
    for (let i = 0; i < handlesArray.length; i++) {
      const id = this.idRegistry.getId(handlesArray[i]);
      if (id) ids.push(id);
    }
    
    return ids;
  }

  /**
   * Query nodes near a point (for snapping)
   */
  queryNear(worldX: number, worldY: number, radius: number): NodeId[] {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const handlesArray = this.core.query_near(worldX, worldY, radius);
    
    // Convert Uint32Array to NodeId[]
    const ids: NodeId[] = [];
    for (let i = 0; i < handlesArray.length; i++) {
      const id = this.idRegistry.getId(handlesArray[i]);
      if (id) ids.push(id);
    }
    
    return ids;
  }

  /**
   * Snap point to grid/objects
   */
  snapPoint(
    worldX: number,
    worldY: number,
    options: SnapOptions
  ): SnapResultData {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const result = this.core.snap_point(
      worldX,
      worldY,
      options.snapThreshold,
      options.gridSize,
      options.enableGrid,
      options.enableObjects
    );

    return {
      snapped: result.snapped,
      x: result.x,
      y: result.y,
      guideCount: result.guide_count,
    };
  }

  /**
   * Convert screen to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): [number, number] {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const coords = this.core.screen_to_world(screenX, screenY);
    return [coords[0], coords[1]];
  }

  /**
   * Convert world to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): [number, number] {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const coords = this.core.world_to_screen(worldX, worldY);
    return [coords[0], coords[1]];
  }

  /**
   * Get node count (for debugging)
   */
  getNodeCount(): number {
    if (!this.core) return 0;
    return this.core.get_node_count();
  }

  /**
   * Clear all nodes
   */
  clear(): void {
    if (!this.core) throw new Error('[WASM] Not initialized');
    this.core.clear();
    this.idRegistry.clear();
  }

  /**
   * Bulk update from scene graph
   */
  updateFromScene(root: SceneNode): void {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const startTime = performance.now();
    let count = 0;

    const traverse = (node: SceneNode, depth: number = 0) => {
      // Update this node
      this.upsertNode(node.id, node.bounds, node.zIndex || depth, {
        hidden: !node.style?.visible,
        locked: node.style?.locked,
      });
      count++;

      // Traverse children
      if (node.children) {
        node.children.forEach((child) => traverse(child, depth + 1));
      }
    };

    traverse(root);

    const elapsed = performance.now() - startTime;
    console.log(
      `[WASM] Updated ${count} nodes in ${elapsed.toFixed(2)}ms`
    );
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Calculate alignment guides (Figma-style)
   * Shows when edges or centers of objects align
   */
  calculateAlignmentGuides(
    movingNodeId: NodeId,
    visibleNodeIds: NodeId[],
    threshold: number = 2
  ): AlignmentGuideData[] {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const movingHandle = this.idRegistry.getHandle(movingNodeId);
    const visibleHandles = visibleNodeIds.map(id => this.idRegistry.getHandle(id));

    const guides = this.core.calculate_alignment_guides(
      movingHandle,
      visibleHandles,
      threshold
    );

    // Map alignment type constants to strings
    const alignmentTypeMap = [
      'edge-left', 'edge-right', 'edge-top', 'edge-bottom', 'center-x', 'center-y'
    ] as const;

    return Array.from(guides).map(guide => ({
      type: guide.guide_type === 0 ? 'vertical' : 'horizontal',
      position: guide.position,
      alignmentType: alignmentTypeMap[guide.alignment_type] as AlignmentGuideData['alignmentType'],
      nodeCount: guide.node_count,
    }));
  }

  /**
   * Calculate spacing guides (Figma-style)
   * Shows when spacing between objects is equal
   */
  calculateSpacingGuides(
    movingNodeId: NodeId,
    visibleNodeIds: NodeId[]
  ): SpacingGuideData[] {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const movingHandle = this.idRegistry.getHandle(movingNodeId);
    const visibleHandles = visibleNodeIds.map(id => this.idRegistry.getHandle(id));

    const guides = this.core.calculate_spacing_guides(movingHandle, visibleHandles);

    return Array.from(guides).map(guide => ({
      type: guide.guide_type === 0 ? 'horizontal' : 'vertical',
      from: {
        x: guide.from_x,
        y: guide.from_y,
        width: guide.from_width,
        height: guide.from_height,
      },
      to: {
        x: guide.to_x,
        y: guide.to_y,
        width: guide.to_width,
        height: guide.to_height,
      },
      spacing: guide.spacing,
    }));
  }

  /**
   * Calculate distance measurements
   * Shows distance from object to nearest siblings or parent bounds
   */
  calculateDistanceMeasurements(
    movingNodeId: NodeId,
    visibleNodeIds: NodeId[],
    parentBounds?: Bounds
  ): DistanceMeasurementData[] {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const movingHandle = this.idRegistry.getHandle(movingNodeId);
    const visibleHandles = visibleNodeIds.map(id => this.idRegistry.getHandle(id));

    const measurements = this.core.calculate_distance_measurements(
      movingHandle,
      visibleHandles,
      parentBounds?.x,
      parentBounds?.y,
      parentBounds?.width,
      parentBounds?.height
    );

    return Array.from(measurements).map(m => ({
      from: { x: m.from_x, y: m.from_y },
      to: { x: m.to_x, y: m.to_y },
      direction: m.direction === 0 ? 'horizontal' : 'vertical',
      distance: m.distance,
    }));
  }
}
