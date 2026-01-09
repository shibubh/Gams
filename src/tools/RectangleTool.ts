/**
 * Rectangle Tool - Draw rectangles.
 */

import type { PointerState, Point, Bounds, ToolType } from '../types';
import type { Tool, ToolContext } from './Tool';
import { createRectangle, addChild } from '../engine/scene/sceneGraph';

export class RectangleTool implements Tool {
  readonly type: ToolType = 'RECTANGLE';
  readonly cursor = 'crosshair';

  private context: ToolContext;
  private startPoint: Point | null = null;
  private isDrawing = false;
  private currentNodeId: string | null = null;

  constructor(context: ToolContext) {
    this.context = context;
  }

  onPointerDown(state: PointerState): void {
    this.isDrawing = true;
    this.startPoint = state.worldPosition;
  }

  onPointerMove(state: PointerState): void {
    if (!this.isDrawing || !this.startPoint) return;

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
      // TODO: Implement node update in scene
    } else {
      // Create new rectangle
      const rect = createRectangle('Rectangle', bounds, {
        fill: { type: 'solid', color: '#3b82f6', opacity: 0.8 },
        stroke: { color: '#1e40af', width: 2 },
      });

      this.currentNodeId = rect.id;
      const newScene = addChild(scene, scene.id, rect);
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
  }

  onActivate(): void {
    // Tool activated
  }

  onDeactivate(): void {
    this.isDrawing = false;
    this.startPoint = null;
    this.currentNodeId = null;
  }
}
