/**
 * Spatial Index Service - Fast hit-testing and spatial queries using RBush
 */

import RBush from "rbush";
import type { ID, SceneNode, Vec2, Rect } from "../core/types";
import { rectContainsPoint } from "../core/math";

interface IndexItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: ID;
}

export class SpatialIndex {
  private tree: RBush<IndexItem>;

  constructor() {
    this.tree = new RBush<IndexItem>();
  }

  /**
   * Rebuild index from nodes
   */
  rebuild(nodes: Record<ID, SceneNode>, rootId: ID): void {
    this.tree.clear();

    const items: IndexItem[] = [];

    for (const id in nodes) {
      // Skip root node
      if (id === rootId) continue;

      const node = nodes[id];
      if (node.hidden || node.locked) continue;

      const b = node.worldBounds;
      items.push({
        minX: b.x,
        minY: b.y,
        maxX: b.x + b.w,
        maxY: b.y + b.h,
        id,
      });
    }

    this.tree.load(items);
  }

  /**
   * Hit test at a point - returns all hits in front-to-back order
   */
  hitTest(pt: Vec2, nodes: Record<ID, SceneNode>): { hitId: ID | null; hits: ID[] } {
    const results = this.tree.search({
      minX: pt.x,
      minY: pt.y,
      maxX: pt.x,
      maxY: pt.y,
    });

    const hits: ID[] = [];

    for (const item of results) {
      const node = nodes[item.id];
      if (!node) continue;

      // More precise hit testing
      if (rectContainsPoint(node.worldBounds, pt)) {
        hits.push(item.id);
      }
    }

    // Return topmost hit
    const hitId = hits.length > 0 ? hits[hits.length - 1] : null;

    return { hitId, hits };
  }

  /**
   * Query all nodes in a rectangular region
   */
  queryRect(rect: Rect): ID[] {
    const results = this.tree.search({
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + rect.w,
      maxY: rect.y + rect.h,
    });

    return results.map((item: IndexItem) => item.id);
  }

  /**
   * Get nearest nodes to a point (for snapping)
   */
  queryNearest(pt: Vec2, maxDistance: number, maxResults = 10): ID[] {
    const searchRect: Rect = {
      x: pt.x - maxDistance,
      y: pt.y - maxDistance,
      w: maxDistance * 2,
      h: maxDistance * 2,
    };

    const candidates = this.tree.search({
      minX: searchRect.x,
      minY: searchRect.y,
      maxX: searchRect.x + searchRect.w,
      maxY: searchRect.y + searchRect.h,
    });

    // Sort by distance
    const sorted = candidates
      .map((item: IndexItem) => {
        const dx = Math.max(item.minX - pt.x, 0, pt.x - item.maxX);
        const dy = Math.max(item.minY - pt.y, 0, pt.y - item.maxY);
        const dist = Math.sqrt(dx * dx + dy * dy);
        return { id: item.id, dist };
      })
      .sort((a: { id: ID; dist: number }, b: { id: ID; dist: number }) => a.dist - b.dist)
      .slice(0, maxResults);

    return sorted.map((item: { id: ID; dist: number }) => item.id);
  }
}
