/**
 * Base Tool interface and tool system architecture.
 * All tools follow this pattern for consistency.
 */

import type { PointerState, SceneNode, ToolType } from '../types';

export interface Tool {
  readonly type: ToolType;
  readonly cursor: string;

  onPointerDown(state: PointerState): void;
  onPointerMove(state: PointerState): void;
  onPointerUp(state: PointerState): void;
  onActivate?(): void;
  onDeactivate?(): void;
}

export interface ToolContext {
  getScene(): SceneNode | null;
  updateScene(scene: SceneNode): void;
  setSelection(nodeIds: string[]): void;
  getSelection(): Set<string>;
  markDirty(): void;
}
