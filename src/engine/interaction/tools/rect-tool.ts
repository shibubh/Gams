/**
 * Rect Tool - Create rectangle shapes
 */

import type { Tool, ToolContext, Vec2 } from "../../core/types";
import { vec2, rect } from "../../core/math";
import { createRectNode } from "../../core/node-utils";
import { CreateNodeCommand } from "../commands";

export class RectTool implements Tool {
  id = "rect" as const;
  
  private dragStart: Vec2 | null = null;
  private dragCurrent: Vec2 | null = null;

  onPointerDown(e: PointerEvent, ctx: ToolContext): void {
    const canvas = e.target as HTMLCanvasElement;
    const canvasRect = canvas.getBoundingClientRect();
    const screenPt = vec2(e.clientX - canvasRect.left, e.clientY - canvasRect.top);
    const worldPt = ctx.toWorld(screenPt);

    // Apply snapping
    const snapped = ctx.snap(worldPt, { includeGrid: true, includeObjects: true });
    this.dragStart = snapped.snapped;
    this.dragCurrent = snapped.snapped;
  }

  onPointerMove(e: PointerEvent, ctx: ToolContext): void {
    if (!this.dragStart) return;

    const canvas = e.target as HTMLCanvasElement;
    const canvasRect = canvas.getBoundingClientRect();
    const screenPt = vec2(e.clientX - canvasRect.left, e.clientY - canvasRect.top);
    const worldPt = ctx.toWorld(screenPt);

    // Apply snapping
    const snapped = ctx.snap(worldPt, { includeGrid: true, includeObjects: true });
    this.dragCurrent = snapped.snapped;

    ctx.requestRender("rect drag");
  }

  onPointerUp(_e: PointerEvent, ctx: ToolContext): void {
    if (!this.dragStart || !this.dragCurrent) return;

    const x1 = Math.min(this.dragStart.x, this.dragCurrent.x);
    const y1 = Math.min(this.dragStart.y, this.dragCurrent.y);
    const x2 = Math.max(this.dragStart.x, this.dragCurrent.x);
    const y2 = Math.max(this.dragStart.y, this.dragCurrent.y);

    const w = x2 - x1;
    const h = y2 - y1;

    // Only create rect if it has meaningful size
    if (w > 5 && h > 5) {
      const rectNode = createRectNode(rect(x1, y1, w, h));

      ctx.store.dispatch({
        type: "EXECUTE_COMMAND",
        command: new CreateNodeCommand(rectNode),
      });
    }

    this.dragStart = null;
    this.dragCurrent = null;

    ctx.requestRender("rect create");
  }

  onKeyDown(e: KeyboardEvent, ctx: ToolContext): void {
    if (e.key === "Escape") {
      this.onCancel?.(ctx);
    }
  }

  onCancel(ctx: ToolContext): void {
    this.dragStart = null;
    this.dragCurrent = null;
    ctx.requestRender("rect cancel");
  }
}
