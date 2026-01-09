/**
 * Select Tool - Selection, marquee, and transform
 */

import type { Tool, ToolContext, Vec2 } from "../../core/types";
import { vec2, vec2Distance, rect } from "../../core/math";
import { SetSelectionCommand, TranslateNodesCommand } from "../commands";

export class SelectTool implements Tool {
  id = "select" as const;
  
  private dragStart: Vec2 | null = null;
  private dragCurrent: Vec2 | null = null;
  private isDragging = false;
  private isMarquee = false;
  private draggedNodeIds: string[] = [];

  onPointerDown(e: PointerEvent, ctx: ToolContext): void {
    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const screenPt = vec2(e.clientX - rect.left, e.clientY - rect.top);
    const worldPt = ctx.toWorld(screenPt);

    this.dragStart = worldPt;
    this.dragCurrent = worldPt;

    // Hit test
    const { hitId } = ctx.hitTestWorld(worldPt);

    const doc = ctx.store.get();
    const isShiftHeld = e.shiftKey;

    if (hitId) {
      // Clicked on a node
      if (doc.selection.includes(hitId)) {
        // Already selected - prepare for drag
        this.isDragging = true;
        this.draggedNodeIds = [...doc.selection];
      } else {
        // Select this node
        if (isShiftHeld) {
          // Add to selection
          ctx.store.dispatch({
            type: "EXECUTE_COMMAND",
            command: new SetSelectionCommand([...doc.selection, hitId], doc.selection),
          });
          this.isDragging = true;
          this.draggedNodeIds = [...doc.selection, hitId];
        } else {
          // Replace selection
          ctx.store.dispatch({
            type: "EXECUTE_COMMAND",
            command: new SetSelectionCommand([hitId], doc.selection),
          });
          this.isDragging = true;
          this.draggedNodeIds = [hitId];
        }
      }
    } else {
      // Clicked on empty space - start marquee
      if (!isShiftHeld) {
        ctx.store.dispatch({
          type: "EXECUTE_COMMAND",
          command: new SetSelectionCommand([], doc.selection),
        });
      }
      this.isMarquee = true;
    }

    ctx.requestRender("select pointer down");
  }

  onPointerMove(e: PointerEvent, ctx: ToolContext): void {
    if (!this.dragStart) return;

    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const screenPt = vec2(e.clientX - rect.left, e.clientY - rect.top);
    const worldPt = ctx.toWorld(screenPt);

    this.dragCurrent = worldPt;

    if (this.isDragging && this.draggedNodeIds.length > 0) {
      // Drag nodes - apply snapping
      const snappedDragPos = ctx.snap(worldPt, { includeGrid: true, includeObjects: false });
      const snappedDelta = {
        x: snappedDragPos.snapped.x - this.dragStart.x,
        y: snappedDragPos.snapped.y - this.dragStart.y,
      };

      if (vec2Distance(vec2(0, 0), snappedDelta) > 0.5) {
        ctx.store.dispatch({
          type: "EXECUTE_COMMAND",
          command: new TranslateNodesCommand(this.draggedNodeIds, snappedDelta),
        });

        // Update drag start for next move
        this.dragStart = snappedDragPos.snapped;
      }
    } else if (this.isMarquee) {
      // Marquee selection
      // TODO: Implement marquee selection rendering and logic
    }

    ctx.requestRender("select pointer move");
  }

  onPointerUp(e: PointerEvent, ctx: ToolContext): void {
    if (this.isMarquee && this.dragStart && this.dragCurrent) {
      // Complete marquee selection
      const x1 = Math.min(this.dragStart.x, this.dragCurrent.x);
      const y1 = Math.min(this.dragStart.y, this.dragCurrent.y);
      const x2 = Math.max(this.dragStart.x, this.dragCurrent.x);
      const y2 = Math.max(this.dragStart.y, this.dragCurrent.y);

      const marqueeRect = rect(x1, y1, x2 - x1, y2 - y1);

      // Find nodes in marquee
      const doc = ctx.store.get();
      const selectedIds: string[] = [];

      for (const id in doc.nodes) {
        if (id === doc.rootId) continue;
        const node = doc.nodes[id];
        if (node.hidden || node.locked) continue;

        const b = node.worldBounds;
        // Simple overlap test
        if (
          b.x < marqueeRect.x + marqueeRect.w &&
          b.x + b.w > marqueeRect.x &&
          b.y < marqueeRect.y + marqueeRect.h &&
          b.y + b.h > marqueeRect.y
        ) {
          selectedIds.push(id);
        }
      }

      if (selectedIds.length > 0) {
        const isShiftHeld = e.shiftKey;
        const newSelection = isShiftHeld
          ? [...new Set([...doc.selection, ...selectedIds])]
          : selectedIds;

        ctx.store.dispatch({
          type: "EXECUTE_COMMAND",
          command: new SetSelectionCommand(newSelection, doc.selection),
        });
      }
    }

    this.dragStart = null;
    this.dragCurrent = null;
    this.isDragging = false;
    this.isMarquee = false;
    this.draggedNodeIds = [];

    ctx.requestRender("select pointer up");
  }

  onKeyDown(e: KeyboardEvent, ctx: ToolContext): void {
    if (e.key === "Escape") {
      this.onCancel?.(ctx);
    }
  }

  onCancel(ctx: ToolContext): void {
    this.dragStart = null;
    this.dragCurrent = null;
    this.isDragging = false;
    this.isMarquee = false;
    this.draggedNodeIds = [];
    ctx.requestRender("select cancel");
  }
}
