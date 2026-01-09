/**
 * Select Tool - Handle node selection, drag, resize, rotate.
 * When moving frames, all children move with the frame.
 */

import type { PointerState, Point, ToolType, Bounds, SceneNode } from '../types';
import type { Tool, ToolContext } from './Tool';
import { getNodesAtPoint, updateNode, findNode, findParentFrame } from '../engine/scene/sceneGraph';
import { useAppStore } from '../state/store';

type ResizeHandle = 
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | 'top' | 'bottom' | 'left' | 'right'
  | null;

export class SelectTool implements Tool {
  readonly type: ToolType = 'SELECT';
  readonly cursor = 'default';

  private context: ToolContext;
  private dragStart: Point | null = null;
  private isDragging = false;
  private isResizing = false;
  private resizeHandle: ResizeHandle = null;
  private originalBounds: Bounds | null = null;
  private draggedNodeIds: Set<string> = new Set();

  constructor(context: ToolContext) {
    this.context = context;
  }

  onPointerDown(state: PointerState): void {
    const scene = this.context.getScene();
    if (!scene) return;

    const selection = this.context.getSelection();
    
    // Check if clicking on a resize handle of selected node
    if (selection.size === 1) {
      const selectedNodeId = Array.from(selection)[0];
      const selectedNode = findNode(scene, selectedNodeId);
      
      if (selectedNode) {
        const handle = this.getHandleAtPoint(selectedNode.bounds, state.worldPosition);
        if (handle) {
          // Start resizing
          this.isResizing = true;
          this.resizeHandle = handle;
          this.originalBounds = { ...selectedNode.bounds };
          this.dragStart = state.worldPosition;
          this.draggedNodeIds = new Set([selectedNodeId]);
          useAppStore.getState().setResizing(true);
          this.context.markDirty();
          return;
        }
      }
    }

    // Find nodes at pointer position
    const nodesAtPoint = getNodesAtPoint(scene, state.worldPosition);

    if (nodesAtPoint.length > 0) {
      // Get topmost node (last in array)
      const node = nodesAtPoint[nodesAtPoint.length - 1];

      // Handle multi-select with shift/meta
      if (state.shiftKey || state.metaKey) {
        if (selection.has(node.id)) {
          selection.delete(node.id);
        } else {
          selection.add(node.id);
        }
        this.context.setSelection(Array.from(selection));
      } else {
        // Single select
        if (!selection.has(node.id)) {
          this.context.setSelection([node.id]);
        }
      }

      // Start drag
      this.dragStart = state.worldPosition;
      this.isDragging = true;
      this.draggedNodeIds = new Set(this.context.getSelection());
      useAppStore.getState().setDragging(true, Array.from(this.draggedNodeIds));
    } else {
      // Clear selection if clicking empty space
      if (!state.shiftKey && !state.metaKey) {
        this.context.setSelection([]);
      }
    }

    this.context.markDirty();
  }

  onPointerMove(state: PointerState): void {
    if (!this.dragStart) return;

    const scene = this.context.getScene();
    if (!scene) return;

    if (this.isResizing && this.resizeHandle && this.originalBounds) {
      // Handle resizing
      const deltaX = state.worldPosition.x - this.dragStart.x;
      const deltaY = state.worldPosition.y - this.dragStart.y;

      const newBounds = this.calculateNewBounds(
        this.originalBounds,
        this.resizeHandle,
        deltaX,
        deltaY
      );

      let updatedScene = scene;
      this.draggedNodeIds.forEach((nodeId) => {
        // Constrain resize within parent frame
        const constrainedBounds = this.constrainBoundsToParent(scene, nodeId, newBounds);
        updatedScene = updateNode(updatedScene, nodeId, { bounds: constrainedBounds });
      });

      this.context.updateScene(updatedScene);
      this.context.markDirty();
    } else if (this.isDragging) {
      // Handle dragging
      const deltaX = state.worldPosition.x - this.dragStart.x;
      const deltaY = state.worldPosition.y - this.dragStart.y;

      let updatedScene = scene;
      this.draggedNodeIds.forEach((nodeId) => {
        updatedScene = this.moveNodeAndChildren(updatedScene, nodeId, deltaX, deltaY);
      });

      this.context.updateScene(updatedScene);
      this.dragStart = state.worldPosition;
      this.context.markDirty();
    }
  }

  onPointerUp(_state: PointerState): void {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.originalBounds = null;
    this.dragStart = null;
    this.draggedNodeIds.clear();
    
    // Update global state
    useAppStore.getState().setDragging(false, []);
    useAppStore.getState().setResizing(false);
    
    this.context.markDirty();
  }

  onActivate(): void {
    // Tool activated
  }

  onDeactivate(): void {
    // Tool deactivated
    this.isDragging = false;
    this.isResizing = false;
    this.dragStart = null;
  }

  /**
   * Detect which resize handle (if any) is at the given point.
   */
  private getHandleAtPoint(bounds: Bounds, point: Point): ResizeHandle {
    const handleSize = 8; // Should match renderer handle size
    const { x, y, width, height } = bounds;

    // Define handle positions (matching renderer)
    const handles: { pos: Point; handle: ResizeHandle }[] = [
      { pos: { x, y }, handle: 'top-left' },
      { pos: { x: x + width, y }, handle: 'top-right' },
      { pos: { x, y: y + height }, handle: 'bottom-left' },
      { pos: { x: x + width, y: y + height }, handle: 'bottom-right' },
      { pos: { x: x + width / 2, y }, handle: 'top' },
      { pos: { x: x + width / 2, y: y + height }, handle: 'bottom' },
      { pos: { x, y: y + height / 2 }, handle: 'left' },
      { pos: { x: x + width, y: y + height / 2 }, handle: 'right' },
    ];

    // Check if point is within any handle
    for (const { pos, handle } of handles) {
      if (
        point.x >= pos.x - handleSize / 2 &&
        point.x <= pos.x + handleSize / 2 &&
        point.y >= pos.y - handleSize / 2 &&
        point.y <= pos.y + handleSize / 2
      ) {
        return handle;
      }
    }

    return null;
  }

  /**
   * Calculate new bounds based on resize handle and delta.
   */
  private calculateNewBounds(
    original: Bounds,
    handle: ResizeHandle,
    deltaX: number,
    deltaY: number
  ): Bounds {
    if (!handle) return original; // Safety check
    
    const { x, y, width, height } = original;
    const newBounds = { x, y, width, height };

    switch (handle) {
      case 'top-left':
        newBounds.x = x + deltaX;
        newBounds.y = y + deltaY;
        newBounds.width = width - deltaX;
        newBounds.height = height - deltaY;
        break;
      case 'top-right':
        newBounds.y = y + deltaY;
        newBounds.width = width + deltaX;
        newBounds.height = height - deltaY;
        break;
      case 'bottom-left':
        newBounds.x = x + deltaX;
        newBounds.width = width - deltaX;
        newBounds.height = height + deltaY;
        break;
      case 'bottom-right':
        newBounds.width = width + deltaX;
        newBounds.height = height + deltaY;
        break;
      case 'top':
        newBounds.y = y + deltaY;
        newBounds.height = height - deltaY;
        break;
      case 'bottom':
        newBounds.height = height + deltaY;
        break;
      case 'left':
        newBounds.x = x + deltaX;
        newBounds.width = width - deltaX;
        break;
      case 'right':
        newBounds.width = width + deltaX;
        break;
    }

    // Prevent negative dimensions
    if (newBounds.width < 10) {
      newBounds.width = 10;
      if (handle.includes('left')) {
        newBounds.x = x + width - 10;
      }
    }
    if (newBounds.height < 10) {
      newBounds.height = 10;
      if (handle.includes('top')) {
        newBounds.y = y + height - 10;
      }
    }

    return newBounds;
  }

  /**
   * Constrain bounds to stay within parent frame.
   * Returns the original bounds if no parent frame exists.
   * 
   * @param scene - The scene root to search for parent frame
   * @param nodeId - The ID of the node to constrain
   * @param bounds - The desired bounds to constrain
   * @returns Constrained bounds that fit within parent frame
   */
  private constrainBoundsToParent(
    scene: SceneNode,
    nodeId: string,
    bounds: Bounds
  ): Bounds {
    const parentFrame = findParentFrame(scene, nodeId);
    
    if (!parentFrame) {
      return bounds;
    }

    const parentBounds = parentFrame.bounds;
    const constrainedBounds = { ...bounds };

    // First, constrain size to fit within parent frame if needed
    if (constrainedBounds.width > parentBounds.width) {
      constrainedBounds.width = parentBounds.width;
    }
    if (constrainedBounds.height > parentBounds.height) {
      constrainedBounds.height = parentBounds.height;
    }

    // Then, constrain position to keep shape completely within parent frame
    // Left constraint
    if (constrainedBounds.x < parentBounds.x) {
      constrainedBounds.x = parentBounds.x;
    }
    // Right constraint
    if (constrainedBounds.x + constrainedBounds.width > parentBounds.x + parentBounds.width) {
      constrainedBounds.x = parentBounds.x + parentBounds.width - constrainedBounds.width;
    }
    // Top constraint
    if (constrainedBounds.y < parentBounds.y) {
      constrainedBounds.y = parentBounds.y;
    }
    // Bottom constraint
    if (constrainedBounds.y + constrainedBounds.height > parentBounds.y + parentBounds.height) {
      constrainedBounds.y = parentBounds.y + parentBounds.height - constrainedBounds.height;
    }

    return constrainedBounds;
  }

  /**
   * Move a node and all its children.
   * When moving a frame, all child shapes move with it.
   * Shapes are constrained to stay within their parent frame bounds.
   * 
   * @param scene - The scene root
   * @param nodeId - The ID of the node to move
   * @param deltaX - Horizontal movement delta
   * @param deltaY - Vertical movement delta
   * @returns Updated scene with moved node and children
   */
  private moveNodeAndChildren(
    scene: SceneNode,
    nodeId: string,
    deltaX: number,
    deltaY: number
  ): SceneNode {
    const currentNode = findNode(scene, nodeId);
    if (!currentNode) return scene;

    // Find parent frame to constrain movement
    const parentFrame = findParentFrame(scene, nodeId);
    
    // Calculate new position
    let newX = currentNode.bounds.x + deltaX;
    let newY = currentNode.bounds.y + deltaY;

    // If node has a parent frame, constrain movement within frame bounds
    if (parentFrame) {
      const parentBounds = parentFrame.bounds;
      const nodeBounds = currentNode.bounds;

      // Constrain to stay within parent frame
      // Left constraint
      if (newX < parentBounds.x) {
        newX = parentBounds.x;
      }
      // Right constraint
      if (newX + nodeBounds.width > parentBounds.x + parentBounds.width) {
        newX = parentBounds.x + parentBounds.width - nodeBounds.width;
      }
      // Top constraint
      if (newY < parentBounds.y) {
        newY = parentBounds.y;
      }
      // Bottom constraint
      if (newY + nodeBounds.height > parentBounds.y + parentBounds.height) {
        newY = parentBounds.y + parentBounds.height - nodeBounds.height;
      }
    }

    // Update the node's position with constrained values
    const newBounds = {
      x: newX,
      y: newY,
      width: currentNode.bounds.width,
      height: currentNode.bounds.height,
    };

    let updatedScene = updateNode(scene, nodeId, { bounds: newBounds });

    // If this node has children (like a frame), move them too
    if (currentNode.children && currentNode.children.length > 0) {
      // Calculate actual delta that was applied (may be different due to constraints)
      const actualDeltaX = newX - currentNode.bounds.x;
      const actualDeltaY = newY - currentNode.bounds.y;
      
      currentNode.children.forEach((child: SceneNode) => {
        updatedScene = this.moveNodeAndChildren(updatedScene, child.id, actualDeltaX, actualDeltaY);
      });
    }

    return updatedScene;
  }
}
