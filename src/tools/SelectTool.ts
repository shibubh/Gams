/**
 * Select Tool - Handle node selection, drag, resize, rotate.
 */

import type { PointerState, Point, ToolType } from '../types';
import type { Tool, ToolContext } from './Tool';
import { getNodesAtPoint } from '../engine/scene/sceneGraph';

export class SelectTool implements Tool {
  readonly type: ToolType = 'SELECT';
  readonly cursor = 'default';

  private context: ToolContext;
  private dragStart: Point | null = null;
  private isDragging = false;
  private draggedNodeIds: Set<string> = new Set();

  constructor(context: ToolContext) {
    this.context = context;
  }

  onPointerDown(state: PointerState): void {
    const scene = this.context.getScene();
    if (!scene) return;

    // Find nodes at pointer position
    const nodesAtPoint = getNodesAtPoint(scene, state.worldPosition);

    if (nodesAtPoint.length > 0) {
      // Get topmost node (last in array)
      const node = nodesAtPoint[nodesAtPoint.length - 1];

      // Handle multi-select with shift/meta
      if (state.shiftKey || state.metaKey) {
        const selection = this.context.getSelection();
        if (selection.has(node.id)) {
          selection.delete(node.id);
        } else {
          selection.add(node.id);
        }
        this.context.setSelection(Array.from(selection));
      } else {
        // Single select
        const selection = this.context.getSelection();
        if (!selection.has(node.id)) {
          this.context.setSelection([node.id]);
        }
      }

      // Start drag
      this.dragStart = state.worldPosition;
      this.isDragging = true;
      this.draggedNodeIds = new Set(this.context.getSelection());
    } else {
      // Clear selection if clicking empty space
      if (!state.shiftKey && !state.metaKey) {
        this.context.setSelection([]);
      }
    }

    this.context.markDirty();
  }

  onPointerMove(state: PointerState): void {
    if (!this.isDragging || !this.dragStart) return;

    const scene = this.context.getScene();
    if (!scene) return;

    // Update dragged nodes
    // TODO: Implement immutable node position updates
    // const deltaX = state.worldPosition.x - this.dragStart.x;
    // const deltaY = state.worldPosition.y - this.dragStart.y;
    // This would update each selected node's position

    this.dragStart = state.worldPosition;
    this.context.markDirty();
  }

  onPointerUp(_state: PointerState): void {
    this.isDragging = false;
    this.dragStart = null;
    this.draggedNodeIds.clear();
  }

  onActivate(): void {
    // Tool activated
  }

  onDeactivate(): void {
    // Tool deactivated
    this.isDragging = false;
    this.dragStart = null;
  }
}
