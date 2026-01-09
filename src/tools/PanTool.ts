/**
 * Pan Tool - Camera panning.
 */

import type { PointerState, Point, ToolType } from '../types';
import type { Tool, ToolContext } from './Tool';
import { CameraController } from '../engine/camera';

export class PanTool implements Tool {
  readonly type: ToolType = 'PAN';
  readonly cursor = 'grab';

  private camera: CameraController;
  private context: ToolContext;
  private lastPosition: Point | null = null;
  private isPanning = false;

  constructor(camera: CameraController, context: ToolContext) {
    this.camera = camera;
    this.context = context;
  }

  onPointerDown(state: PointerState): void {
    this.isPanning = true;
    this.lastPosition = state.position;
  }

  onPointerMove(state: PointerState): void {
    if (!this.isPanning || !this.lastPosition) return;

    const deltaX = state.position.x - this.lastPosition.x;
    const deltaY = state.position.y - this.lastPosition.y;

    this.camera.pan(-deltaX, -deltaY);
    this.lastPosition = state.position;
    this.context.markDirty();
  }

  onPointerUp(_state: PointerState): void {
    this.isPanning = false;
    this.lastPosition = null;
  }

  onActivate(): void {
    // Tool activated
  }

  onDeactivate(): void {
    this.isPanning = false;
    this.lastPosition = null;
  }
}
