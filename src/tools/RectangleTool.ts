/**
 * Rectangle Tool - Draw rectangles inside frames.
 */

import type { PointerState, Point, Bounds, ToolType } from '../types';
import type { Tool, ToolContext } from './Tool';
import { createRectangle, addChild, updateNode, getNodesAtPoint } from '../engine/scene/sceneGraph';

export class RectangleTool implements Tool {
  readonly type: ToolType = 'RECTANGLE';
  readonly cursor = 'crosshair';

  private context: ToolContext;
  private startPoint: Point | null = null;
  private isDrawing = false;
  private currentNodeId: string | null = null;
  private targetFrameId: string | null = null;

  constructor(context: ToolContext) {
    this.context = context;
  }

  onPointerDown(state: PointerState): void {
    const scene = this.context.getScene();
    if (!scene) return;

    // Find frame at pointer position
    const nodesAtPoint = getNodesAtPoint(scene, state.worldPosition);
    const frame = nodesAtPoint.find(node => node.type === 'FRAME');
    
    if (!frame) {
      // Cannot draw without a frame
      console.warn('Cannot draw rectangle: No frame at position. Create a frame first.');
      return;
    }

    this.targetFrameId = frame.id;
    this.isDrawing = true;
    this.startPoint = state.worldPosition;
  }

  onPointerMove(state: PointerState): void {
    if (!this.isDrawing || !this.startPoint || !this.targetFrameId) return;

    const scene = this.context.getScene();
    if (!scene) return;

    // Calculate bounds
    const bounds: Bounds = {
      x: Math.min(this.startPoint.x, state.worldPosition.x),
      y: Math.min(this.startPoint.y, state.worldPosition.y),
      width: Math.abs(state.worldPosition.x - this.startPoint.x),
      height: Math.abs(state.worldPosition.y - this.startPoint.y),
    };

    if (this.currentNodeId) {
      // Update existing rectangle
      const newScene = updateNode(scene, this.currentNodeId, { bounds });
      this.context.updateScene(newScene);
    } else {
      // Create new rectangle inside the frame
      const rect = createRectangle('Rectangle', bounds, {
        fill: { type: 'solid', color: '#f59e0b', opacity: 0.8 },
        stroke: { color: '#d97706', width: 2 },
      });

      this.currentNodeId = rect.id;
      const newScene = addChild(scene, this.targetFrameId, rect);
      this.context.updateScene(newScene);
    }

    this.context.markDirty();
  }

  onPointerUp(_state: PointerState): void {
    if (this.currentNodeId) {
      // Select the created rectangle
      this.context.setSelection([this.currentNodeId]);
    }

    this.isDrawing = false;
    this.startPoint = null;
    this.currentNodeId = null;
    this.targetFrameId = null;
  }

  onActivate(): void {
    // Tool activated
  }

  onDeactivate(): void {
    this.isDrawing = false;
    this.startPoint = null;
    this.currentNodeId = null;
    this.targetFrameId = null;
  }
}
