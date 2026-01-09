/**
 * Pan Tool - Canvas panning/navigation
 */

import type { Tool, ToolContext, Vec2 } from "../../core/types";
import { vec2 } from "../../core/math";

export class PanTool implements Tool {
  id = "pan" as const;
  
  private dragStart: Vec2 | null = null;
  private panStart: Vec2 | null = null;

  onPointerDown(e: PointerEvent, ctx: ToolContext): void {
    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    this.dragStart = vec2(e.clientX - rect.left, e.clientY - rect.top);
    this.panStart = { ...ctx.camera.pan };
  }

  onPointerMove(e: PointerEvent, ctx: ToolContext): void {
    if (!this.dragStart || !this.panStart) return;

    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const currentPt = vec2(e.clientX - rect.left, e.clientY - rect.top);

    const dx = currentPt.x - this.dragStart.x;
    const dy = currentPt.y - this.dragStart.y;

    // Update camera pan (screen space delta divided by zoom for world space)
    const newPan = vec2(
      this.panStart.x - dx / ctx.camera.zoom,
      this.panStart.y - dy / ctx.camera.zoom
    );

    // Update camera directly (no command for pan)
    ctx.camera.pan = newPan;
    ctx.requestRender("pan move");
  }

  onPointerUp(_e: PointerEvent, _ctx: ToolContext): void {
    this.dragStart = null;
    this.panStart = null;
  }

  onKeyDown(e: KeyboardEvent, ctx: ToolContext): void {
    if (e.key === "Escape") {
      this.onCancel?.(ctx);
    }
  }

  onCancel(_ctx: ToolContext): void {
    this.dragStart = null;
    this.panStart = null;
  }
}
