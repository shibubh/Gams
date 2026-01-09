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
    const handles = this.core.cull_visible();
    const ids = handles
      .map((handle) => this.idRegistry.getId(handle))
      .filter((id): id is string => id !== undefined);

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
    const handles = this.core.hit_test_point(worldX, worldY);
    const ids = handles
      .map((handle) => this.idRegistry.getId(handle))
      .filter((id): id is string => id !== undefined);

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

    const handles = this.core.query_rect(
      bounds.x,
      bounds.y,
      bounds.x + bounds.width,
      bounds.y + bounds.height
    );

    return handles
      .map((handle) => this.idRegistry.getId(handle))
      .filter((id): id is string => id !== undefined);
  }

  /**
   * Query nodes near a point (for snapping)
   */
  queryNear(worldX: number, worldY: number, radius: number): NodeId[] {
    if (!this.core) throw new Error('[WASM] Not initialized');

    const handles = this.core.query_near(worldX, worldY, radius);
    return handles
      .map((handle) => this.idRegistry.getId(handle))
      .filter((id): id is string => id !== undefined);
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
}
