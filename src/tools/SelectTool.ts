/**
 * Select Tool - Handle node selection, drag, resize, rotate.
 * When moving frames, all children move with the frame.
 */

import type { PointerState, Point, ToolType } from '../types';
import type { Tool, ToolContext } from './Tool';
import { getNodesAtPoint, updateNode, findNode } from '../engine/scene/sceneGraph';

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

    // Calculate delta movement in world space
    const deltaX = state.worldPosition.x - this.dragStart.x;
    const deltaY = state.worldPosition.y - this.dragStart.y;

    // Update each selected node's position
    // For frames, this will automatically move all children
    // because children positions are relative to the frame
    let updatedScene = scene;
    this.draggedNodeIds.forEach((nodeId) => {
      updatedScene = this.moveNodeAndChildren(updatedScene, nodeId, deltaX, deltaY);
    });

    this.context.updateScene(updatedScene);
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

  /**
   * Move a node and all its children.
   * When moving a frame, all child shapes move with it.
   */
  private moveNodeAndChildren(
    scene: any,
    nodeId: string,
    deltaX: number,
    deltaY: number
  ): any {
    const currentNode = findNode(scene, nodeId);
    if (!currentNode) return scene;

    // Update the node's position
    const newBounds = {
      x: currentNode.bounds.x + deltaX,
      y: currentNode.bounds.y + deltaY,
      width: currentNode.bounds.width,
      height: currentNode.bounds.height,
    };

    let updatedScene = updateNode(scene, nodeId, { bounds: newBounds });

    // If this node has children (like a frame), move them too
    if (currentNode.children && currentNode.children.length > 0) {
      currentNode.children.forEach((child: any) => {
        updatedScene = this.moveNodeAndChildren(updatedScene, child.id, deltaX, deltaY);
      });
    }

    return updatedScene;
  }
}
