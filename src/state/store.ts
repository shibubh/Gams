/**
 * Application state store using Zustand.
 * Manages scene, selection, tools, and history.
 */

import { create } from 'zustand';
import type { SceneNode, ToolType, NodeId, Document } from '../types/core';
import { createFrame } from '../engine/scene/sceneGraph';

export interface AppState {
  // Document
  document: Document | null;
  scene: SceneNode | null;

  // Selection
  selectedNodes: Set<NodeId>;
  hoveredNode: NodeId | null;

  // Tools
  currentTool: ToolType;

  // Interaction state (for Figma-style guides)
  isDragging: boolean;
  isResizing: boolean;
  draggedNodes: Set<NodeId>;

  // History
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setScene: (scene: SceneNode) => void;
  updateScene: (scene: SceneNode) => void;
  setSelection: (nodeIds: NodeId[]) => void;
  addToSelection: (nodeId: NodeId) => void;
  removeFromSelection: (nodeId: NodeId) => void;
  clearSelection: () => void;
  setHoveredNode: (nodeId: NodeId | null) => void;
  setTool: (tool: ToolType) => void;
  setDragging: (isDragging: boolean, nodeIds?: NodeId[]) => void;
  setResizing: (isResizing: boolean) => void;
  undo: () => void;
  redo: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  document: null,
  scene: createFrame('Root', { x: 0, y: 0, width: 10000, height: 10000 }, {
    visible: false, // Hide the root frame so it doesn't render
  }),
  selectedNodes: new Set(),
  hoveredNode: null,
  currentTool: 'SELECT' as ToolType,
  isDragging: false,
  isResizing: false,
  draggedNodes: new Set(),
  canUndo: false,
  canRedo: false,

  // Actions
  setScene: (scene) => set({ scene }),

  updateScene: (scene) => set({ scene }),

  setSelection: (nodeIds) => set({ selectedNodes: new Set(nodeIds) }),

  addToSelection: (nodeId) =>
    set((state) => {
      const newSet = new Set(state.selectedNodes);
      newSet.add(nodeId);
      return { selectedNodes: newSet };
    }),

  removeFromSelection: (nodeId) =>
    set((state) => {
      const newSet = new Set(state.selectedNodes);
      newSet.delete(nodeId);
      return { selectedNodes: newSet };
    }),

  clearSelection: () => set({ selectedNodes: new Set() }),

  setHoveredNode: (nodeId) => set({ hoveredNode: nodeId }),

  setTool: (tool) => set({ currentTool: tool }),

  setDragging: (isDragging, nodeIds = []) => 
    set({ isDragging, draggedNodes: new Set(nodeIds) }),

  setResizing: (isResizing) => set({ isResizing }),

  undo: () => {
    // TODO: Implement history undo
    console.log('Undo');
  },

  redo: () => {
    // TODO: Implement history redo
    console.log('Redo');
  },
}));
