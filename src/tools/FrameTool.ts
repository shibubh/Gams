/**
 * Frame Tool - Create frames (containers).
 * Frames are required before drawing other nodes.
 */

import type { PointerState, Point, Bounds, ToolType } from '../types';
import type { Tool, ToolContext } from './Tool';
import { createFrame, addChild } from '../engine/scene/sceneGraph';

export class FrameTool implements Tool {
  readonly type: ToolType = 'FRAME';
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
      // Update existing frame
      // TODO: Implement node update in scene
    } else {
      // Create new frame
      const frame = createFrame('Frame', bounds, {
        fill: { type: 'solid', color: '#ffffff', opacity: 1 },
        stroke: { color: '#e0e0e0', width: 1 },
      });

      this.currentNodeId = frame.id;
      const newScene = addChild(scene, scene.id, frame);
      this.context.updateScene(newScene);
    }

    this.context.markDirty();
  }

  onPointerUp(_state: PointerState): void {
    if (this.currentNodeId) {
      // Select the created frame
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
