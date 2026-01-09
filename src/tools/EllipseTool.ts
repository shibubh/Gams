/**
 * Ellipse Tool - Draw ellipses/circles.
 */

import type { PointerState, Point, Bounds, ToolType } from '../types';
import type { Tool, ToolContext } from './Tool';
import { createEllipse, addChild, findNode } from '../engine/scene/sceneGraph';

export class EllipseTool implements Tool {
  readonly type: ToolType = 'ELLIPSE';
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

    // Check if there's an active frame to draw in
    const selectedNodes = Array.from(this.context.getSelection());
    let targetFrame = scene;
    
    // If a frame is selected, draw inside it
    if (selectedNodes.length > 0) {
      const selectedNode = findNode(scene, selectedNodes[0]);
      if (selectedNode && selectedNode.type === 'FRAME') {
        targetFrame = selectedNode;
      }
    }

    // Calculate bounds
    const bounds: Bounds = {
      x: Math.min(this.startPoint.x, state.worldPosition.x),
      y: Math.min(this.startPoint.y, state.worldPosition.y),
      width: Math.abs(state.worldPosition.x - this.startPoint.x),
      height: Math.abs(state.worldPosition.y - this.startPoint.y),
    };

    if (this.currentNodeId) {
      // Update existing ellipse
      // TODO: Implement node update in scene
    } else {
      // Create new ellipse
      const ellipse = createEllipse('Ellipse', bounds, {
        fill: { type: 'solid', color: '#60a5fa', opacity: 0.8 },
        stroke: { color: '#3b82f6', width: 2 },
      });

      this.currentNodeId = ellipse.id;
      const newScene = addChild(scene, targetFrame.id, ellipse);
      this.context.updateScene(newScene);
    }

    this.context.markDirty();
  }

  onPointerUp(_state: PointerState): void {
    if (this.currentNodeId) {
      // Select the created ellipse
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
