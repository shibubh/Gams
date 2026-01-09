/**
 * Snapping Service - Grid and object snapping
 */

import type { Vec2, SceneNode } from "../core/types";

const SNAP_THRESHOLD = 10; // pixels in world space
const GRID_SIZE = 50;

export interface SnapGuide {
  type: "grid" | "object-edge" | "object-center";
  axis: "x" | "y";
  value: number;
  sourceNodeId?: string;
}

export interface SnapResult {
  snapped: Vec2;
  guides: SnapGuide[];
}

export class SnappingService {
  /**
   * Snap a point to grid and/or objects
   */
  snap(
    pt: Vec2,
    nodes: Record<string, SceneNode>,
    rootId: string,
    options: { includeGrid?: boolean; includeObjects?: boolean } = {}
  ): SnapResult {
    const { includeGrid = true, includeObjects = false } = options;

    let snapped = { ...pt };
    const guides: SnapGuide[] = [];

    // Grid snapping
    if (includeGrid) {
      const gridResult = this.snapToGrid(pt);
      if (gridResult.snapped) {
        snapped = gridResult.snapped;
        guides.push(...gridResult.guides);
      }
    }

    // Object snapping
    if (includeObjects) {
      const objectResult = this.snapToObjects(pt, nodes, rootId);
      if (objectResult.snapped) {
        snapped = objectResult.snapped;
        guides.push(...objectResult.guides);
      }
    }

    return { snapped, guides };
  }

  private snapToGrid(pt: Vec2): SnapResult {
    const guides: SnapGuide[] = [];
    const snapped = { ...pt };

    const gridX = Math.round(pt.x / GRID_SIZE) * GRID_SIZE;
    const gridY = Math.round(pt.y / GRID_SIZE) * GRID_SIZE;

    const snapX = Math.abs(pt.x - gridX) < SNAP_THRESHOLD;
    const snapY = Math.abs(pt.y - gridY) < SNAP_THRESHOLD;

    if (snapX) {
      snapped.x = gridX;
      guides.push({
        type: "grid",
        axis: "x",
        value: gridX,
      });
    }

    if (snapY) {
      snapped.y = gridY;
      guides.push({
        type: "grid",
        axis: "y",
        value: gridY,
      });
    }

    return { snapped, guides };
  }

  private snapToObjects(pt: Vec2, nodes: Record<string, SceneNode>, rootId: string): SnapResult {
    const guides: SnapGuide[] = [];
    const snapped = { ...pt };
    let closestX: { dist: number; value: number; nodeId: string } | null = null;
    let closestY: { dist: number; value: number; nodeId: string } | null = null;

    for (const id in nodes) {
      if (id === rootId) continue;

      const node = nodes[id];
      if (node.hidden || node.locked) continue;

      const b = node.worldBounds;

      // Check edges and center
      const candidates = [
        { x: b.x, type: "object-edge" as const },
        { x: b.x + b.w / 2, type: "object-center" as const },
        { x: b.x + b.w, type: "object-edge" as const },
      ];

      for (const candidate of candidates) {
        const dist = Math.abs(pt.x - candidate.x);
        if (dist < SNAP_THRESHOLD && (!closestX || dist < closestX.dist)) {
          closestX = { dist, value: candidate.x, nodeId: id };
        }
      }

      const candidatesY = [
        { y: b.y, type: "object-edge" as const },
        { y: b.y + b.h / 2, type: "object-center" as const },
        { y: b.y + b.h, type: "object-edge" as const },
      ];

      for (const candidate of candidatesY) {
        const dist = Math.abs(pt.y - candidate.y);
        if (dist < SNAP_THRESHOLD && (!closestY || dist < closestY.dist)) {
          closestY = { dist, value: candidate.y, nodeId: id };
        }
      }
    }

    if (closestX) {
      snapped.x = closestX.value;
      guides.push({
        type: "object-edge",
        axis: "x",
        value: closestX.value,
        sourceNodeId: closestX.nodeId,
      });
    }

    if (closestY) {
      snapped.y = closestY.value;
      guides.push({
        type: "object-edge",
        axis: "y",
        value: closestY.value,
        sourceNodeId: closestY.nodeId,
      });
    }

    return { snapped, guides };
  }
}
